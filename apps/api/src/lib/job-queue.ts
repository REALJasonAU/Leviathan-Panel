import type { FastifyInstance } from "fastify";
import { Queue, Worker, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

import type { JobRecord } from "@voltan/shared";

import { config } from "../config.js";
import { store } from "./store.js";
import { runScheduledTask } from "./task-runner.js";

const workerId = `api-${process.pid}-${Math.random().toString(16).slice(2)}`;

export const enqueueScheduledTaskJob = async (
  taskId: string,
  actorId = "system",
) => {
  const record = await store.createJob({
    type: "scheduled-task",
    dedupeKey: `scheduled-task:${taskId}`,
    payload: { taskId, actorId },
    status: "pending",
    attempts: 0,
    maxAttempts: 2,
    runAfter: new Date().toISOString(),
  });
  if (bullQueue) {
    await bullQueue.add(record.type, { jobId: record.id }, {
      jobId: record.dedupeKey,
      attempts: record.maxAttempts,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: false,
    } satisfies JobsOptions);
  }
  return record;
};

let bullQueue: Queue | null = null;
let bullConnection: Redis | null = null;

const runJob = async (fastify: FastifyInstance, job: JobRecord) => {
  try {
    if (job.type === "scheduled-task") {
      const taskId = String(job.payload.taskId ?? "");
      const actorId = String(job.payload.actorId ?? "system");
      await runScheduledTask(fastify, taskId, actorId);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    await store.updateJob(job.id, {
      status: "success",
      lockedBy: undefined,
      lockedUntil: undefined,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    const retry = job.attempts < job.maxAttempts;
    await store.updateJob(job.id, {
      status: retry ? "pending" : "failed",
      lockedBy: undefined,
      lockedUntil: undefined,
      runAfter: new Date(Date.now() + 30_000).toISOString(),
      errorMessage: message,
      completedAt: retry ? undefined : new Date().toISOString(),
    });
    fastify.log.warn({ jobId: job.id, error: message, retry }, "Job failed");
  }
};

export const startJobWorker = (fastify: FastifyInstance) => {
  if (config.QUEUE_DRIVER === "bullmq") {
    if (!config.REDIS_URL) {
      throw new Error("REDIS_URL is required when QUEUE_DRIVER=bullmq");
    }
    bullConnection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    bullQueue = new Queue("leviathan-jobs", { connection: bullConnection });
    const worker = new Worker(
      "leviathan-jobs",
      async (bullJob) => {
        const jobId = String(bullJob.data.jobId);
        const [record] = (await store.listJobs(500)).filter(
          (job) => job.id === jobId,
        );
        if (!record) {
          throw new Error(`Job record ${jobId} not found`);
        }
        const running = await store.updateJob(record.id, {
          status: "running",
          attempts: record.attempts + 1,
          lockedBy: workerId,
          lockedUntil: new Date(Date.now() + 60_000).toISOString(),
        });
        await runJob(fastify, running ?? record);
      },
      { connection: bullConnection, concurrency: 5 },
    );

    fastify.addHook("onClose", async () => {
      await worker.close();
      await bullQueue?.close();
      await bullConnection?.quit();
    });
    return;
  }

  const tick = async () => {
    const jobs = await store.claimPendingJobs(workerId, 5);
    await Promise.all(jobs.map((job) => runJob(fastify, job)));
  };

  void tick();
  const interval = setInterval(() => {
    void tick();
  }, 5_000);

  fastify.addHook("onClose", async () => {
    clearInterval(interval);
  });
};

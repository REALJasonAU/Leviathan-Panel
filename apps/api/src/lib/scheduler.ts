import type { FastifyInstance } from "fastify";
import cron from "node-cron";

import { enqueueScheduledTaskJob, startJobWorker } from "./job-queue.js";
import { store } from "./store.js";

export const startTaskScheduler = (fastify: FastifyInstance) => {
  startJobWorker(fastify);
  const scheduled = new Map<string, cron.ScheduledTask>();

  const sync = async () => {
    const tasks = await store.listAllScheduledTasks();
    const activeIds = new Set<string>();

    for (const task of tasks) {
      activeIds.add(task.id);
      if (!task.enabled) {
        scheduled.get(task.id)?.stop();
        scheduled.delete(task.id);
        continue;
      }

      const existing = scheduled.get(task.id);
      if (existing) {
        continue;
      }

      const runner = cron.schedule(task.cron, () => {
        void enqueueScheduledTaskJob(task.id, "system");
      });
      scheduled.set(task.id, runner);
    }

    for (const [taskId, runner] of scheduled.entries()) {
      if (!activeIds.has(taskId)) {
        runner.stop();
        scheduled.delete(taskId);
      }
    }
  };

  void sync();
  const interval = setInterval(() => {
    void sync();
  }, 30_000);

  fastify.addHook("onClose", async () => {
    clearInterval(interval);
    for (const runner of scheduled.values()) {
      runner.stop();
    }
    scheduled.clear();
  });
};

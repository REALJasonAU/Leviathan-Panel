import Fastify from "fastify";
import { pipeline } from "node:stream/promises";

import { config } from "./config.js";
import { DockerManager } from "./docker.js";
import { MetricsCollector } from "./metrics.js";
import { PanelClient } from "./panel-client.js";
import { TransferManager } from "./transfers.js";
import { WorkspaceManager } from "./workspace.js";

const start = async () => {
  const workspace = new WorkspaceManager(config.DAEMON_BASE_DIR);
  const docker = new DockerManager(config.DOCKER_SOCKET_PATH, workspace);
  const metrics = new MetricsCollector();
  const transfers = new TransferManager();
  const panelClient = new PanelClient(docker, workspace, metrics, transfers);

  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "leviathan-daemon",
    nodeId: config.NODE_ID,
    time: new Date().toISOString(),
  }));

  app.get("/v1/transfers/:id/file", async (request, reply) => {
    const { id } = request.params as { id: string };
    const grant = transfers.get(id, "file-download");
    if (!grant?.path) {
      return reply.code(404).send({ error: "Transfer not found" });
    }
    return reply
      .header("content-type", "application/octet-stream")
      .send(workspace.createFileReadStream(grant.serverId, grant.path));
  });

  app.put("/v1/transfers/:id/file", async (request, reply) => {
    const { id } = request.params as { id: string };
    const grant = transfers.get(id, "file-upload");
    if (!grant?.path) {
      return reply.code(404).send({ error: "Transfer not found" });
    }
    const writer = await workspace.createFileWriteStream(
      grant.serverId,
      grant.path,
    );
    await pipeline(request.raw, writer);
    return { uploaded: true };
  });

  app.get("/v1/transfers/:id/backup", async (request, reply) => {
    const { id } = request.params as { id: string };
    const grant = transfers.get(id, "backup-download");
    if (!grant?.backupId) {
      return reply.code(404).send({ error: "Transfer not found" });
    }
    const backupPath = await workspace.findBackupPath(
      grant.serverId,
      grant.backupId,
    );
    return reply
      .header("content-type", "application/gzip")
      .send(workspace.createBackupReadStream(grant.serverId, backupPath));
  });

  app.delete("/v1/transfers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { cancelled: transfers.cancel(id) };
  });

  const cleanupInterval = setInterval(() => transfers.cleanup(), 60_000);
  app.addHook("onClose", async () => clearInterval(cleanupInterval));

  await panelClient.start();
  await app.listen({
    host: config.DAEMON_HOST,
    port: config.DAEMON_PORT,
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

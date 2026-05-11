import {
  DaemonEnvelopeSchema,
  DaemonRegisterResponseSchema,
} from "@voltan/shared";
import type { ServerRecord } from "@voltan/shared";
import path from "node:path";
import WebSocket from "ws";

import { config } from "./config.js";
import type { DockerManager } from "./docker.js";
import { applyFirewallRules } from "./firewall.js";
import type { MetricsCollector } from "./metrics.js";
import { reloadProxyConfig } from "./proxy.js";
import {
  deleteBackupFromS3,
  downloadBackupFromS3,
  uploadBackupToS3,
} from "./s3-backup.js";
import { provisionSftpCredential, revokeSftpCredential } from "./sftp.js";
import type { TransferKind, TransferManager } from "./transfers.js";
import { executeDaemonUpdate, planDaemonUpdate } from "./updater.js";
import { fingerprintMachine, nowIso } from "./utils.js";
import type { WorkspaceManager } from "./workspace.js";

type WebSocketLike = InstanceType<typeof WebSocket>;

export class PanelClient {
  private socket: WebSocketLike | null = null;
  private daemonToken = config.DAEMON_TOKEN ?? null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;

  constructor(
    private readonly docker: DockerManager,
    private readonly workspace: WorkspaceManager,
    private readonly metrics: MetricsCollector,
    private readonly transfers: TransferManager,
  ) {
    this.docker.setConsoleHandler((serverId, chunk) => {
      void this.publishConsole(serverId, chunk);
    });
  }

  async start() {
    await this.workspace.ensureBase();
    await this.registerIfNeeded();
    await this.connectSocket();
  }

  private async registerIfNeeded() {
    if (this.daemonToken) {
      return;
    }

    if (!config.BOOTSTRAP_TOKEN) {
      throw new Error(
        "BOOTSTRAP_TOKEN is required when DAEMON_TOKEN is not set",
      );
    }

    const response = await fetch(`${config.PANEL_URL}/v1/daemon/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nodeId: config.NODE_ID,
        bootstrapToken: config.BOOTSTRAP_TOKEN,
        fingerprint: fingerprintMachine(),
        version: "0.2.0",
      }),
    });

    if (!response.ok) {
      throw new Error(`Daemon registration failed with ${response.status}`);
    }

    const payload = DaemonRegisterResponseSchema.parse(await response.json());
    this.daemonToken = payload.daemonToken;
  }

  private async connectSocket() {
    if (!this.daemonToken) {
      throw new Error("Daemon token missing");
    }

    const socketUrl = `${config.PANEL_URL.replace(/^http/, "ws")}/v1/daemon/socket?nodeId=${encodeURIComponent(config.NODE_ID)}`;
    const socket = new WebSocket(socketUrl, {
      headers: {
        Authorization: `Bearer ${this.daemonToken}`,
      },
    });

    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.send({
        type: "daemon.ready",
        payload: {
          nodeId: config.NODE_ID,
          bootedAt: nowIso(),
          fingerprint: fingerprintMachine(),
          version: "0.2.0",
        },
      });

      this.metricsInterval = setInterval(() => {
        void this.publishMetrics();
      }, 15_000);
    });

    socket.addEventListener("message", (event) => {
      void this.handleMessage(event.data.toString());
    });

    socket.addEventListener("close", () => {
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      const delay = Math.min(30_000, 2_000 * 2 ** this.reconnectAttempt);
      this.reconnectAttempt += 1;
      setTimeout(() => {
        void this.connectSocket();
      }, delay);
    });
  }

  private async publishMetrics() {
    this.send({
      type: "daemon.metrics",
      payload: {
        nodeId: config.NODE_ID,
        metrics: await this.metrics.snapshot(),
        serverMetrics: await this.docker.collectServerMetrics(),
      },
    });
  }

  private async publishConsole(serverId: string, chunk: string) {
    this.send({
      type: "server.console",
      payload: {
        serverId,
        chunk: await this.redactConsoleChunk(serverId, chunk),
        timestamp: nowIso(),
      },
    });
  }

  private async redactConsoleChunk(serverId: string, chunk: string) {
    const server = await this.workspace.loadServer(serverId);
    if (!server) {
      return chunk;
    }
    let redacted = chunk;
    for (const definition of server.environmentDefinitions) {
      if (!definition.secret) {
        continue;
      }
      const value = server.environment[definition.key];
      if (value) {
        redacted = redacted.split(value).join("[redacted]");
      }
    }
    return redacted;
  }

  private async handleMessage(raw: string) {
    const envelope = DaemonEnvelopeSchema.parse(JSON.parse(raw));
    const payload = envelope.payload as Record<string, unknown>;

    try {
      let result: Record<string, unknown> = { ok: true };

      switch (envelope.type) {
        case "server.create": {
          const server = payload.server as ServerRecord;
          await this.workspace.ensureServer(server);
          await this.docker.ensureContainer(server);
          result = { created: true, serverId: server.id };
          break;
        }
        case "server.start": {
          await this.docker.startServer(String(payload.serverId));
          await this.sendServerStatus(String(payload.serverId), "running");
          break;
        }
        case "server.stop": {
          await this.docker.stopServer(String(payload.serverId));
          await this.sendServerStatus(String(payload.serverId), "stopped");
          break;
        }
        case "server.restart": {
          await this.docker.restartServer(String(payload.serverId));
          await this.sendServerStatus(String(payload.serverId), "running");
          break;
        }
        case "server.kill": {
          await this.docker.killServer(String(payload.serverId));
          await this.sendServerStatus(String(payload.serverId), "stopped");
          break;
        }
        case "server.delete": {
          await this.docker.deleteServer(String(payload.serverId));
          result = { deleted: true };
          break;
        }
        case "server.syncEnvironment": {
          const server = await this.workspace.loadServer(
            String(payload.serverId),
          );
          if (!server) {
            throw new Error("Server metadata missing");
          }
          const next = {
            ...server,
            environment: payload.environment as Record<string, string>,
          };
          await this.workspace.ensureServer(next);
          await this.docker.recreateContainer(next);
          result = { synced: true, serverId: next.id };
          break;
        }
        case "server.console.command": {
          result = (await this.docker.sendConsoleCommand(
            String(payload.serverId),
            String(payload.command),
          )) as Record<string, unknown>;
          break;
        }
        case "server.files.list": {
          result = {
            entries: await this.workspace.listFiles(
              String(payload.serverId),
              String(payload.path ?? "."),
            ),
          };
          break;
        }
        case "server.files.read": {
          result = await this.workspace.readFile(
            String(payload.serverId),
            String(payload.path),
          );
          break;
        }
        case "server.files.write": {
          result = await this.workspace.writeFile(
            String(payload.serverId),
            String(payload.path),
            String(payload.content),
            (payload.encoding as "utf8" | "base64" | undefined) ?? "utf8",
          );
          break;
        }
        case "server.files.delete": {
          result = await this.workspace.deleteFile(
            String(payload.serverId),
            String(payload.path),
          );
          break;
        }
        case "server.files.mkdir": {
          result = await this.workspace.makeDirectory(
            String(payload.serverId),
            String(payload.path),
          );
          break;
        }
        case "server.files.move": {
          result = await this.workspace.moveFile(
            String(payload.serverId),
            String(payload.sourcePath),
            String(payload.destinationPath),
          );
          break;
        }
        case "server.files.copy": {
          result = await this.workspace.copyFile(
            String(payload.serverId),
            String(payload.sourcePath),
            String(payload.destinationPath),
          );
          break;
        }
        case "server.files.rename": {
          result = await this.workspace.renameFile(
            String(payload.serverId),
            String(payload.sourcePath),
            String(payload.newName),
          );
          break;
        }
        case "server.files.archive": {
          result = await this.workspace.archivePath(
            String(payload.serverId),
            String(payload.sourcePath),
            String(payload.archivePath),
          );
          break;
        }
        case "server.files.extract": {
          result = await this.workspace.extractArchive(
            String(payload.serverId),
            String(payload.archivePath),
            String(payload.destinationPath),
          );
          break;
        }
        case "server.files.cleanup": {
          result = await this.workspace.cleanupFiles(
            String(payload.serverId),
            String(payload.path),
            Number(payload.olderThanDays),
          );
          break;
        }
        case "server.backup.create": {
          result = await this.workspace.createBackup(
            String(payload.serverId),
            String(payload.backupId),
            String(payload.backupName),
          );
          if (payload.provider === "s3" && payload.target) {
            const uploaded = await uploadBackupToS3({
              target: payload.target as never,
              serverId: String(payload.serverId),
              backupId: String(payload.backupId),
              filePath: String(result.filePath),
            });
            result = { ...result, ...uploaded };
          }
          break;
        }
        case "server.backup.restore": {
          const serverId = String(payload.serverId);
          const backupFilePath =
            payload.provider === "s3" && payload.target && payload.objectKey
              ? (
                  await downloadBackupFromS3({
                    target: payload.target as never,
                    objectKey: String(payload.objectKey),
                    destinationPath: path.join(
                      this.workspace.getBackupRoot(serverId),
                      path.basename(String(payload.objectKey)),
                    ),
                  })
                ).filePath
              : await this.lookupBackupPath(serverId, String(payload.backupId));
          result = await this.workspace.restoreBackup(
            serverId,
            backupFilePath,
            Boolean(payload.overwrite),
          );
          break;
        }
        case "server.backup.download": {
          const serverId = String(payload.serverId);
          const backupFilePath =
            payload.provider === "s3" && payload.target && payload.objectKey
              ? (
                  await downloadBackupFromS3({
                    target: payload.target as never,
                    objectKey: String(payload.objectKey),
                    destinationPath: path.join(
                      this.workspace.getBackupRoot(serverId),
                      path.basename(String(payload.objectKey)),
                    ),
                  })
                ).filePath
              : await this.lookupBackupPath(serverId, String(payload.backupId));
          result = await this.workspace.readBackup(serverId, backupFilePath);
          break;
        }
        case "server.backup.delete": {
          const serverId = String(payload.serverId);
          if (
            payload.provider === "s3" &&
            payload.target &&
            payload.objectKey
          ) {
            result = await deleteBackupFromS3({
              target: payload.target as never,
              objectKey: String(payload.objectKey),
            });
            break;
          }
          const backupFilePath = await this.lookupBackupPath(
            serverId,
            String(payload.backupId),
          );
          result = await this.workspace.deleteBackup(serverId, backupFilePath);
          break;
        }
        case "transfer.issue": {
          const grant = this.transfers.create({
            kind: String(payload.kind) as TransferKind,
            serverId: String(payload.serverId),
            path: typeof payload.path === "string" ? payload.path : undefined,
            backupId:
              typeof payload.backupId === "string"
                ? payload.backupId
                : undefined,
          });
          result = {
            transferId: grant.id,
            expiresAt: new Date(grant.expiresAt).toISOString(),
          };
          break;
        }
        case "transfer.cancel": {
          result = {
            cancelled: this.transfers.cancel(String(payload.transferId)),
          };
          break;
        }
        case "server.sftp.rotate": {
          const credential = payload.credential as {
            serverId: string;
            username: string;
            rootPath: string;
          };
          result = await provisionSftpCredential(credential);
          break;
        }
        case "server.sftp.revoke": {
          result = await revokeSftpCredential(String(payload.serverId));
          break;
        }
        case "firewall.apply": {
          result = await applyFirewallRules(
            payload.rules as never[],
            Boolean(payload.dryRun),
          );
          break;
        }
        case "proxy.reload": {
          result = await reloadProxyConfig(
            payload.server as ServerRecord,
            payload.mappings as never[],
          );
          break;
        }
        case "node.daemon.update": {
          const input = {
            manifest: payload.manifest as never,
            publicKeyPem: String(payload.publicKeyPem ?? ""),
          };
          result = payload.apply
            ? await executeDaemonUpdate(input)
            : await planDaemonUpdate(input);
          break;
        }
        default:
          result = { ignored: true, type: envelope.type };
      }

      this.send({
        type: "command.result",
        requestId: envelope.requestId,
        payload: result,
      });
    } catch (error) {
      this.send({
        type: "command.result",
        requestId: envelope.requestId,
        payload: {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  private async lookupBackupPath(serverId: string, backupId: string) {
    return this.workspace.findBackupPath(serverId, backupId);
  }

  private async sendServerStatus(serverId: string, status: string) {
    let lastCrashAt: string | undefined;
    try {
      const inspect = await this.docker.inspectServer(serverId);
      if (!inspect.State.Running && inspect.State.ExitCode !== 0) {
        lastCrashAt = nowIso();
      }
    } catch {
      // Best effort.
    }
    this.send({
      type: "server.status",
      payload: {
        serverId,
        status,
        lastCrashAt,
      },
    });
  }

  private send(message: {
    type: string;
    requestId?: string;
    payload: Record<string, unknown>;
  }) {
    this.socket?.send(JSON.stringify(message));
  }
}

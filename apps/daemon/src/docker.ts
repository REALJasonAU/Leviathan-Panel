import Docker from "dockerode";
import type { Duplex } from "node:stream";
import type { ServerMetricRecord, ServerRecord } from "@voltan/shared";

import { serverContainerName } from "./utils.js";
import type { WorkspaceManager } from "./workspace.js";

type ConsoleHandler = (serverId: string, chunk: string) => void;

export class DockerManager {
  readonly docker: Docker;
  private consoleHandler: ConsoleHandler | null = null;
  private readonly consoleStreams = new Map<string, Duplex>();
  private readonly followedLogs = new Set<string>();

  constructor(
    socketPath: string,
    private readonly workspace: WorkspaceManager,
  ) {
    this.docker = new Docker({ socketPath });
  }

  setConsoleHandler(handler: ConsoleHandler) {
    this.consoleHandler = handler;
  }

  private emitConsole(serverId: string, chunk: string) {
    this.consoleHandler?.(serverId, chunk);
  }

  private environmentToArray(environment: Record<string, string>) {
    return Object.entries(environment).map(([key, value]) => `${key}=${value}`);
  }

  private buildPortBindings(server: ServerRecord) {
    const portBindings: Record<
      string,
      Array<{ HostPort: string; HostIp: string }>
    > = {};
    const exposedPorts: Record<string, Record<string, never>> = {};

    for (const allocation of server.allocations) {
      const key = `${allocation.port}/tcp`;
      portBindings[key] = [
        {
          HostIp: allocation.ip,
          HostPort: String(allocation.port),
        },
      ];
      exposedPorts[key] = {};
    }

    return { portBindings, exposedPorts };
  }

  async pullImage(image: string) {
    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (error: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async ensureContainer(server: ServerRecord) {
    const containerName = serverContainerName(server.id);
    const existing = await this.findContainer(containerName);
    if (existing) {
      return existing;
    }

    await this.pullImage(server.dockerImage);
    await this.workspace.ensureServer(server);
    const serverRoot = this.workspace.getServerRoot(server.id);
    const { exposedPorts, portBindings } = this.buildPortBindings(server);
    const container = (await this.docker.createContainer({
      name: containerName,
      Image: server.dockerImage,
      Cmd: ["sh", "-lc", server.startup.command],
      WorkingDir: server.workingDirectory,
      Env: this.environmentToArray(server.environment),
      Tty: true,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      OpenStdin: true,
      StdinOnce: false,
      ExposedPorts: exposedPorts,
      HostConfig: {
        Binds: [`${serverRoot}:${server.workingDirectory}`],
        PortBindings: portBindings,
        Memory: server.limits.memoryMb * 1024 * 1024,
        NanoCpus: Math.floor((server.limits.cpuPercent / 100) * 1_000_000_000),
        RestartPolicy: {
          Name: server.restartPolicy,
        },
      },
      Labels: {
        "leviathan.serverId": server.id,
        "leviathan.nodeManaged": "true",
        "voltan.serverId": server.id,
        "voltan.nodeManaged": "true",
      },
    })) as Docker.Container;

    return container;
  }

  async recreateContainer(server: ServerRecord) {
    const existing = await this.findContainer(serverContainerName(server.id));
    let shouldRestart = false;

    if (existing) {
      const inspect = await existing.inspect();
      shouldRestart = inspect.State.Running;
      if (shouldRestart) {
        await existing.stop().catch(() => undefined);
      }
      await existing.remove({ force: true });
      this.consoleStreams.delete(server.id);
      this.followedLogs.delete(server.id);
    }

    const container = await this.ensureContainer(server);
    if (shouldRestart) {
      await container.start();
      await this.attachLiveConsole(server.id, container);
    }
  }

  async startServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    await container.start();
    await this.attachLiveConsole(serverId, container);
  }

  async stopServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    await container.stop({ t: 10 });
  }

  async restartServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    await container.restart({ t: 10 });
    await this.attachLiveConsole(serverId, container);
  }

  async killServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    await container.kill();
  }

  async deleteServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    try {
      await container.stop({ t: 10 });
    } catch {
      // Best effort.
    }
    await container.remove({ force: true });
    this.consoleStreams.delete(serverId);
    this.followedLogs.delete(serverId);
  }

  async inspectServer(serverId: string) {
    const container = await this.requireContainer(serverId);
    return container.inspect();
  }

  async sendConsoleCommand(serverId: string, command: string) {
    const stream = await this.getConsoleInputStream(serverId);
    stream.write(`${command}\n`);
    this.emitConsole(serverId, `> ${command}\n`);
    return { sent: true };
  }

  async collectServerMetrics(): Promise<ServerMetricRecord[]> {
    const containers = await this.docker.listContainers({
      all: true,
    });

    const metrics: ServerMetricRecord[] = [];
    for (const item of containers) {
      const managed =
        item.Labels["leviathan.nodeManaged"] === "true" ||
        item.Labels["voltan.nodeManaged"] === "true";
      if (!managed) {
        continue;
      }
      const serverId =
        item.Labels["leviathan.serverId"] ?? item.Labels["voltan.serverId"];
      if (!serverId) {
        continue;
      }
      const container = this.docker.getContainer(item.Id);
      try {
        const stats = (await container.stats({
          stream: false,
        })) as {
          cpu_stats?: {
            cpu_usage?: { total_usage?: number };
            system_cpu_usage?: number;
          };
          precpu_stats?: {
            cpu_usage?: { total_usage?: number };
            system_cpu_usage?: number;
          };
          memory_stats?: { usage?: number; limit?: number };
          networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
        };
        const cpuDelta =
          (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
          (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
        const systemDelta =
          (stats.cpu_stats?.system_cpu_usage ?? 0) -
          (stats.precpu_stats?.system_cpu_usage ?? 0);
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
        const networks = Object.values(stats.networks ?? {});
        metrics.push({
          serverId,
          cpuPercent,
          memoryUsedMb: (stats.memory_stats?.usage ?? 0) / 1024 / 1024,
          memoryLimitMb: (stats.memory_stats?.limit ?? 0) / 1024 / 1024,
          networkRxBytes: networks.reduce(
            (sum, entry) => sum + (entry.rx_bytes ?? 0),
            0,
          ),
          networkTxBytes: networks.reduce(
            (sum, entry) => sum + (entry.tx_bytes ?? 0),
            0,
          ),
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Skip containers that cannot provide stats.
      }
    }
    return metrics;
  }

  private async getConsoleInputStream(serverId: string) {
    const existing = this.consoleStreams.get(serverId);
    if (existing) {
      return existing;
    }

    const container = await this.requireContainer(serverId);
    const stream = (await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    })) as Duplex;
    this.consoleStreams.set(serverId, stream);
    return stream;
  }

  private async attachLiveConsole(
    serverId: string,
    container: Docker.Container,
  ) {
    if (this.followedLogs.has(serverId)) {
      return;
    }
    const stream = (await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 50,
    })) as Duplex;
    this.followedLogs.add(serverId);
    stream.on("data", (chunk: Buffer) => {
      this.emitConsole(serverId, chunk.toString("utf8"));
    });
    stream.on("end", () => {
      this.followedLogs.delete(serverId);
    });
    stream.on("error", () => {
      this.followedLogs.delete(serverId);
    });
  }

  private async requireContainer(serverId: string) {
    const container = await this.findContainer(serverContainerName(serverId));
    if (!container) {
      throw new Error(`Container not found for ${serverId}`);
    }
    return container;
  }

  private async findContainer(name: string): Promise<Docker.Container | null> {
    const containers = await this.docker.listContainers({ all: true });
    const found = containers.find((container) =>
      container.Names.some((containerName) => containerName === `/${name}`),
    );
    return found ? this.docker.getContainer(found.Id) : null;
  }
}

import { describe, expect, it } from "vitest";

import { generateCaddyConfig } from "./proxy.js";

describe("proxy config", () => {
  it("generates caddy reverse proxy config", () => {
    const config = generateCaddyConfig(
      {
        id: "srv_1",
        name: "Test",
        ownerId: "user",
        nodeId: "node",
        templateId: "tpl",
        dockerImage: "nginx",
        status: "running",
        suspended: false,
        allocations: [
          {
            ip: "127.0.0.1",
            port: 8080,
            primary: true,
            assignedServerId: null,
          },
        ],
        limits: { cpuPercent: 100, memoryMb: 512, diskMb: 1024 },
        startup: { command: "nginx" },
        environment: {},
        environmentDefinitions: [],
        workingDirectory: "/srv/app",
        restartPolicy: "unless-stopped",
        members: [],
        firewallRules: [],
        backupLimit: 3,
        uptimeSeconds: 0,
        crashCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastCrashAt: null,
      },
      [
        {
          id: "dom_1",
          serverId: "srv_1",
          domain: "app.example.com",
          targetPort: 8080,
          provider: "caddy",
          tls: true,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    );

    expect(config).toContain("app.example.com");
    expect(config).toContain("reverse_proxy 127.0.0.1:8080");
  });
});

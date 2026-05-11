import { describe, expect, it } from "vitest";

import { syncCloudflareRoute } from "./cloudflare.js";

describe("cloudflare provider", () => {
  it("returns dry-run operations without calling Cloudflare", async () => {
    const result = await syncCloudflareRoute(
      {
        id: "global",
        appName: "Leviathan",
        backup: { retentionCount: 3, defaultProvider: "local" },
        metrics: { retentionHours: 72 },
        alerts: { nodeOfflineMinutes: 2 },
        cloudflare: {
          enabled: true,
          accountId: "acct",
          zoneId: "zone",
          apiToken: "token",
        },
        updatedAt: new Date().toISOString(),
      },
      {
        id: "route_1",
        hostname: "play.example.com",
        service: "http://localhost:25565",
        tunnelId: "tun",
        zoneId: "zone",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      true,
    );

    expect(result.dryRun).toBe(true);
    expect(result.operations).toHaveLength(2);
  });
});

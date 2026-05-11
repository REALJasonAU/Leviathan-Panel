import { describe, expect, it } from "vitest";

import { buildUfwCommands } from "./firewall.js";

describe("firewall rule generation", () => {
  it("generates deterministic ufw commands", () => {
    expect(
      buildUfwCommands([
        {
          id: "fw_1",
          scope: "server",
          scopeId: "srv_1",
          protocol: "tcp",
          port: 25565,
          source: "0.0.0.0/0",
          action: "allow",
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ]),
    ).toEqual([
      [
        "allow",
        "from",
        "0.0.0.0/0",
        "to",
        "any",
        "port",
        "25565",
        "proto",
        "tcp",
        "comment",
        "leviathan:server:srv_1:fw_1",
      ],
    ]);
  });
});

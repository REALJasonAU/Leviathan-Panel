import { describe, expect, it } from "vitest";

import { hasPermission } from "./permissions.js";

describe("hasPermission", () => {
  it("honours wildcard permissions", () => {
    expect(hasPermission(["*"], "servers.view")).toBe(true);
  });

  it("requires every permission in an array", () => {
    expect(
      hasPermission(
        ["servers.view", "servers.power"],
        ["servers.view", "servers.power"],
      ),
    ).toBe(true);
    expect(
      hasPermission(["servers.view"], ["servers.view", "servers.power"]),
    ).toBe(false);
  });
});

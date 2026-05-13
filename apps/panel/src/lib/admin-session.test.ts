import { describe, expect, it } from "vitest";

import { isAdminSession } from "./admin-session";

describe("isAdminSession", () => {
  it("does not treat shared user permissions as admin access", () => {
    expect(
      isAdminSession({
        roles: [
          {
            id: "user",
            name: "User",
            permissions: ["dashboard.view", "servers.view"],
          },
        ],
        permissions: ["dashboard.view", "servers.view"],
      }),
    ).toBe(false);
  });

  it("treats the built-in admin role as admin access", () => {
    expect(
      isAdminSession({
        roles: [{ id: "admin", name: "Administrator", permissions: ["*"] }],
        permissions: ["*"],
      }),
    ).toBe(true);
  });
});

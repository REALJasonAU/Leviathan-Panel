import { describe, expect, it } from "vitest";

import { assertSftpPathInsideRoot, provisionSftpCredential } from "./sftp.js";

describe("sftp isolation", () => {
  it("allows paths inside the server root", () => {
    expect(
      assertSftpPathInsideRoot("/srv/leviathan/servers/a", "world"),
    ).toContain("world");
  });

  it("rejects traversal outside the server root", () => {
    expect(() =>
      assertSftpPathInsideRoot("/srv/leviathan/servers/a", "../../etc/passwd"),
    ).toThrow("SFTP path escapes");
  });

  it("rejects expired credentials", async () => {
    await expect(
      provisionSftpCredential({
        serverId: "srv_1",
        username: "srv_1",
        rootPath: "/srv/leviathan/servers/srv_1",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ).rejects.toThrow("expired");
  });
});

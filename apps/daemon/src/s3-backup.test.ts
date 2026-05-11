import { describe, expect, it } from "vitest";

import { buildBackupObjectKey } from "./s3-backup.js";

describe("s3 backup provider", () => {
  it("builds stable object keys", () => {
    expect(
      buildBackupObjectKey(
        {
          region: "us-east-1",
          bucket: "leviathan",
          accessKeyId: "test",
          secretAccessKey: "secret",
          pathPrefix: "panel/backups",
        },
        "srv_123",
        "bak_123",
        "archive.tar.gz",
      ),
    ).toBe("panel/backups/srv_123/bak_123-archive.tar.gz");
  });
});

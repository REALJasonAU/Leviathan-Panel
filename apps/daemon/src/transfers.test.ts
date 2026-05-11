import { describe, expect, it } from "vitest";

import { TransferManager } from "./transfers.js";

describe("transfer manager", () => {
  it("creates, reads, and cancels short-lived transfer grants", () => {
    const transfers = new TransferManager();
    const grant = transfers.create({
      kind: "file-download",
      serverId: "srv_1",
      path: "world/level.dat",
    });

    expect(transfers.get(grant.id, "file-download")?.serverId).toBe("srv_1");
    expect(transfers.cancel(grant.id)).toBe(true);
    expect(transfers.get(grant.id, "file-download")).toBeNull();
  });
});

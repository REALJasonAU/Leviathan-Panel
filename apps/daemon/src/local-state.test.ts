import { afterEach, describe, expect, it } from "vitest";

import { createDaemonStateStore } from "./local-state.js";

describe("daemon local state store", () => {
  const stores: Array<Awaited<ReturnType<typeof createDaemonStateStore>>> = [];

  afterEach(async () => {
    while (stores.length > 0) {
      await stores.pop()?.close();
    }
  });

  it("persists transfer grants in memory driver mode", async () => {
    const store = await createDaemonStateStore({
      driver: "memory",
      namespace: "daemon-test",
    });
    stores.push(store);

    await store.saveTransfer({
      id: "transfer-1",
      kind: "file-download",
      serverId: "srv_1",
      path: "logs/latest.log",
      createdAt: 1,
      expiresAt: 2,
      cancelled: false,
    });

    expect(await store.getTransfer("transfer-1")).toMatchObject({
      id: "transfer-1",
      serverId: "srv_1",
    });
  });
});

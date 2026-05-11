import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import fs from "fs-extra";

import { WorkspaceManager } from "./workspace.js";

const tempRoot = path.join(os.tmpdir(), "leviathan-workspace-test");

afterEach(async () => {
  await fs.remove(tempRoot);
});

describe("workspace manager", () => {
  it("blocks traversal outside the server root", async () => {
    const workspace = new WorkspaceManager(tempRoot);
    await workspace.ensureBase();
    await expect(
      workspace.writeFile("srv_test", "../escape.txt", "bad"),
    ).rejects.toThrow(/outside server root/i);
  });
});

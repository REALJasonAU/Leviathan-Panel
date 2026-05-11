import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { loadPluginDirectory } from "./plugin-loader.js";

describe("plugin runtime loader", () => {
  it("loads trusted plugins and registers routes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "leviathan-plugin-"));
    const pluginDir = path.join(root, "hello");
    await mkdir(pluginDir);
    await writeFile(
      path.join(pluginDir, "plugin.json"),
      JSON.stringify({
        id: "plugin_test",
        name: "Plugin Test",
        version: "1.0.0",
        entry: "index.cjs",
        enabled: true,
        trusted: true,
      }),
    );
    await writeFile(
      path.join(pluginDir, "index.cjs"),
      "module.exports.register = ({ app }) => app.get('/plugin-test', async () => ({ ok: true }));",
    );

    const app = Fastify();
    const loaded = await loadPluginDirectory(app, root);
    const response = await app.inject("/plugin-test");

    expect(loaded).toHaveLength(1);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});

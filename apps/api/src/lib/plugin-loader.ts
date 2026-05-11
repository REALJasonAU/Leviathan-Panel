import { pathToFileURL } from "node:url";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { FastifyInstance } from "fastify";

import { PluginManifestSchema, type PluginManifest } from "@voltan/shared";

import { config } from "../config.js";

export type PluginRuntimeContext = {
  app: FastifyInstance;
  manifest: PluginManifest;
};

export type RuntimePlugin = {
  register?: (context: PluginRuntimeContext) => Promise<void> | void;
};

const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<RuntimePlugin>;
const requirePlugin = createRequire(import.meta.url);

const loadRuntimePlugin = async (entryPath: string) => {
  if (entryPath.endsWith(".cjs")) {
    return requirePlugin(entryPath) as RuntimePlugin;
  }
  return nativeImport(pathToFileURL(entryPath).toString());
};

export const loadPluginDirectory = async (
  app: FastifyInstance,
  pluginsDir = config.PLUGINS_DIR,
) => {
  let entries: string[] = [];
  try {
    entries = await readdir(pluginsDir);
  } catch {
    return [];
  }

  const loaded: PluginManifest[] = [];
  for (const entry of entries) {
    const root = path.join(pluginsDir, entry);
    const manifest = PluginManifestSchema.parse(
      JSON.parse(await readFile(path.join(root, "plugin.json"), "utf8")),
    );
    if (!manifest.enabled || !manifest.trusted) {
      continue;
    }
    const runtime = await loadRuntimePlugin(path.join(root, manifest.entry));
    await runtime.register?.({ app, manifest });
    loaded.push(manifest);
  }
  return loaded;
};

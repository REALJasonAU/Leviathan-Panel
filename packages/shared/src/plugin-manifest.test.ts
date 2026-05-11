import { describe, expect, it } from "vitest";

import { PluginManifestSchema } from "./schemas/platform.js";

describe("plugin manifest", () => {
  it("validates trusted plugin manifests", () => {
    const manifest = PluginManifestSchema.parse({
      id: "plugin_example",
      name: "Example Plugin",
      version: "1.0.0",
      entry: "index.js",
      trusted: true,
      contributes: {
        adminNavigation: ["Example"],
      },
    });

    expect(manifest.contributes.adminNavigation).toEqual(["Example"]);
  });
});

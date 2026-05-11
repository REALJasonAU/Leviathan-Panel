import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { manifestSigningPayload, verifyUpdateManifest } from "./updater.js";

describe("daemon update manifest", () => {
  it("verifies signed manifests and rejects tampering", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const manifest = {
      version: "0.4.0",
      url: "https://example.com/leviathan-daemon.tar.gz",
      sha256: "a".repeat(64),
      publishedAt: new Date().toISOString(),
      signature: "",
    };
    manifest.signature = sign(
      "sha256",
      Buffer.from(manifestSigningPayload(manifest)),
      privateKey,
    ).toString("base64");

    expect(
      verifyUpdateManifest(
        manifest,
        publicKey.export({ type: "spki", format: "pem" }).toString(),
      ),
    ).toBe(true);

    expect(
      verifyUpdateManifest(
        { ...manifest, version: "0.4.1" },
        publicKey.export({ type: "spki", format: "pem" }).toString(),
      ),
    ).toBe(false);
  });
});

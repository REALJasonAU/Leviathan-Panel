import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secrets.js";

describe("secret encryption", () => {
  it("encrypts and decrypts local secrets", () => {
    const encrypted = encryptSecret("cloudflare-token");
    expect(encrypted).not.toBe("cloudflare-token");
    expect(isEncryptedSecret(encrypted!)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("cloudflare-token");
  });
});

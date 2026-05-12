import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./passwords.js";

describe("password hashing", () => {
  it("hashes passwords and verifies the original secret", async () => {
    const hash = await hashPassword("abyss-admin-password");

    expect(hash).not.toBe("abyss-admin-password");
    await expect(verifyPassword("abyss-admin-password", hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});

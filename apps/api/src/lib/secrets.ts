import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { config } from "../config.js";

const prefix = "enc:v1:";

const key = () => {
  const raw = config.SECRET_ENCRYPTION_KEY ?? "leviathan-local-development-key";
  return createHash("sha256").update(raw).digest();
};

export const isEncryptedSecret = (value: string) => value.startsWith(prefix);

export const encryptSecret = (value: string | undefined) => {
  if (!value || isEncryptedSecret(value) || value === "[redacted]") {
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${prefix}${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
};

export const decryptSecret = (value: string | undefined) => {
  if (!value || !isEncryptedSecret(value)) {
    return value;
  }
  const payload = Buffer.from(value.slice(prefix.length), "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

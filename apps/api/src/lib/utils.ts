import crypto from "node:crypto";

export const nowIso = () => new Date().toISOString();

export const generateId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export const generateToken = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(24).toString("hex")}`;

export const hashToken = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

import { randomBytes } from "node:crypto";

export type TransferKind =
  | "file-download"
  | "file-upload"
  | "backup-download"
  | "backup-restore";

export type TransferGrant = {
  id: string;
  kind: TransferKind;
  serverId: string;
  path?: string;
  backupId?: string;
  createdAt: number;
  expiresAt: number;
  cancelled: boolean;
};

export class TransferManager {
  private readonly transfers = new Map<string, TransferGrant>();

  create(
    input: Omit<TransferGrant, "id" | "createdAt" | "expiresAt" | "cancelled">,
  ) {
    const now = Date.now();
    const grant: TransferGrant = {
      id: randomBytes(32).toString("hex"),
      ...input,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
      cancelled: false,
    };
    this.transfers.set(grant.id, grant);
    return grant;
  }

  get(id: string, kind: TransferKind) {
    const grant = this.transfers.get(id);
    if (
      !grant ||
      grant.kind !== kind ||
      grant.cancelled ||
      grant.expiresAt <= Date.now()
    ) {
      return null;
    }
    return grant;
  }

  cancel(id: string) {
    const grant = this.transfers.get(id);
    if (!grant) {
      return false;
    }
    this.transfers.set(id, { ...grant, cancelled: true });
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, grant] of this.transfers.entries()) {
      if (grant.cancelled || grant.expiresAt <= now) {
        this.transfers.delete(id);
      }
    }
  }
}

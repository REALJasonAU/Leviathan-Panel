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

  constructor(
    private readonly stateStore?: {
      saveTransfer: (grant: TransferGrant) => Promise<void>;
      listTransfers: () => Promise<TransferGrant[]>;
      deleteTransfer: (id: string) => Promise<void>;
    },
  ) {}

  async hydrate() {
    if (!this.stateStore) {
      return;
    }
    const grants = await this.stateStore.listTransfers();
    this.transfers.clear();
    for (const grant of grants) {
      this.transfers.set(grant.id, grant);
    }
  }

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
    void this.stateStore?.saveTransfer(grant);
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
    const updated = { ...grant, cancelled: true };
    this.transfers.set(id, updated);
    void this.stateStore?.saveTransfer(updated);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, grant] of this.transfers.entries()) {
      if (grant.cancelled || grant.expiresAt <= now) {
        this.transfers.delete(id);
        void this.stateStore?.deleteTransfer(id);
      }
    }
  }
}

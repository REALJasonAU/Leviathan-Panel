import { createPool, type Pool } from "mysql2/promise";

import type { TransferGrant } from "./transfers.js";

type DriverOptions =
  | {
      driver: "memory";
      namespace?: string;
    }
  | {
      driver: "mysql";
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      namespace?: string;
    };

type StoredTransfer = TransferGrant;

type StateStore = {
  saveTransfer: (grant: StoredTransfer) => Promise<void>;
  getTransfer: (id: string) => Promise<StoredTransfer | null>;
  listTransfers: () => Promise<StoredTransfer[]>;
  deleteTransfer: (id: string) => Promise<void>;
  close: () => Promise<void>;
};

class MemoryStateStore implements StateStore {
  private readonly transfers = new Map<string, StoredTransfer>();

  async saveTransfer(grant: StoredTransfer) {
    this.transfers.set(grant.id, grant);
  }

  async getTransfer(id: string) {
    return this.transfers.get(id) ?? null;
  }

  async listTransfers() {
    return [...this.transfers.values()];
  }

  async deleteTransfer(id: string) {
    this.transfers.delete(id);
  }

  async close() {}
}

class MysqlStateStore implements StateStore {
  private readonly pool: Pool;
  private readonly namespace: string;

  private constructor(pool: Pool, namespace: string) {
    this.pool = pool;
    this.namespace = namespace;
  }

  static async create(options: Extract<DriverOptions, { driver: "mysql" }>) {
    const pool = createPool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      connectionLimit: 5,
      waitForConnections: true,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leviathan_daemon_state (
        namespace VARCHAR(120) NOT NULL,
        category VARCHAR(64) NOT NULL,
        item_id VARCHAR(120) NOT NULL,
        payload LONGTEXT NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (namespace, category, item_id)
      )
    `);

    return new MysqlStateStore(pool, options.namespace ?? "daemon");
  }

  async saveTransfer(grant: StoredTransfer) {
    await this.pool.query(
      `
        INSERT INTO leviathan_daemon_state (namespace, category, item_id, payload, updated_at)
        VALUES (?, 'transfer', ?, ?, ?)
        ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)
      `,
      [
        this.namespace,
        grant.id,
        JSON.stringify(grant),
        new Date().toISOString().slice(0, 23).replace("T", " "),
      ],
    );
  }

  async getTransfer(id: string) {
    const [rows] = await this.pool.query(
      `
        SELECT payload
        FROM leviathan_daemon_state
        WHERE namespace = ? AND category = 'transfer' AND item_id = ?
        LIMIT 1
      `,
      [this.namespace, id],
    );
    const row = (rows as Array<{ payload: string }>)[0];
    return row ? (JSON.parse(row.payload) as StoredTransfer) : null;
  }

  async listTransfers() {
    const [rows] = await this.pool.query(
      `
        SELECT payload
        FROM leviathan_daemon_state
        WHERE namespace = ? AND category = 'transfer'
      `,
      [this.namespace],
    );
    return (rows as Array<{ payload: string }>).map(
      (row) => JSON.parse(row.payload) as StoredTransfer,
    );
  }

  async deleteTransfer(id: string) {
    await this.pool.query(
      `
        DELETE FROM leviathan_daemon_state
        WHERE namespace = ? AND category = 'transfer' AND item_id = ?
      `,
      [this.namespace, id],
    );
  }

  async close() {
    await this.pool.end();
  }
}

export const createDaemonStateStore = async (options: DriverOptions) => {
  if (options.driver === "memory") {
    return new MemoryStateStore();
  }
  return MysqlStateStore.create(options);
};

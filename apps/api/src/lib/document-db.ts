import { randomUUID } from "node:crypto";
import { createPool, type Pool } from "mysql2/promise";

type SetOptions = {
  merge?: boolean;
};

type StoredDocument = {
  value: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDatabaseOptions =
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
      connectionLimit?: number;
    };

type DocumentSnapshot = {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
  ref: {
    set: (
      value: Record<string, unknown>,
      options?: SetOptions,
    ) => Promise<void>;
    delete: () => Promise<void>;
  };
};

type CollectionSnapshot = {
  docs: DocumentSnapshot[];
};

type DocumentReference = {
  get: () => Promise<DocumentSnapshot>;
  set: (value: Record<string, unknown>, options?: SetOptions) => Promise<void>;
  delete: () => Promise<void>;
};

type CollectionReference = {
  doc: (id: string) => DocumentReference;
  get: () => Promise<CollectionSnapshot>;
};

export type DocumentDatabase = {
  namespace: string;
  collection: (name: string) => CollectionReference;
  close: () => Promise<void>;
};

const nowIso = () => new Date().toISOString();

const shallowMerge = (
  current: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
) => ({
  ...(current ?? {}),
  ...next,
});

class MemoryDocumentDatabase implements DocumentDatabase {
  readonly namespace: string;
  private readonly records = new Map<string, StoredDocument>();

  constructor(namespace = "default") {
    this.namespace = namespace;
  }

  private key(collection: string, id: string) {
    return `${this.namespace}:${collection}:${id}`;
  }

  collection(name: string): CollectionReference {
    return {
      doc: (id) => ({
        get: async () => {
          const record = this.records.get(this.key(name, id));
          return {
            id,
            exists: Boolean(record),
            data: () => record?.value,
            ref: {
              set: async (value, options) => {
                const current = this.records.get(this.key(name, id));
                const createdAt = current?.createdAt ?? nowIso();
                this.records.set(this.key(name, id), {
                  value: options?.merge
                    ? shallowMerge(current?.value, value)
                    : value,
                  createdAt,
                  updatedAt: nowIso(),
                });
              },
              delete: async () => {
                this.records.delete(this.key(name, id));
              },
            },
          };
        },
        set: async (value, options) => {
          const current = this.records.get(this.key(name, id));
          const createdAt = current?.createdAt ?? nowIso();
          this.records.set(this.key(name, id), {
            value: options?.merge ? shallowMerge(current?.value, value) : value,
            createdAt,
            updatedAt: nowIso(),
          });
        },
        delete: async () => {
          this.records.delete(this.key(name, id));
        },
      }),
      get: async () => {
        const docs: DocumentSnapshot[] = [];
        for (const [key, record] of this.records.entries()) {
          const prefix = `${this.namespace}:${name}:`;
          if (!key.startsWith(prefix)) {
            continue;
          }
          const id = key.slice(prefix.length);
          docs.push({
            id,
            exists: true,
            data: () => record.value,
            ref: {
              set: async (value, options) => {
                const current = this.records.get(this.key(name, id));
                const createdAt = current?.createdAt ?? nowIso();
                this.records.set(this.key(name, id), {
                  value: options?.merge
                    ? shallowMerge(current?.value, value)
                    : value,
                  createdAt,
                  updatedAt: nowIso(),
                });
              },
              delete: async () => {
                this.records.delete(this.key(name, id));
              },
            },
          });
        }
        docs.sort((left, right) => left.id.localeCompare(right.id));
        return { docs };
      },
    };
  }

  async close() {}
}

class MysqlDocumentDatabase implements DocumentDatabase {
  readonly namespace: string;
  private readonly pool: Pool;

  constructor(pool: Pool, namespace = "default") {
    this.pool = pool;
    this.namespace = namespace;
  }

  static async create(
    options: Extract<DocumentDatabaseOptions, { driver: "mysql" }>,
  ) {
    const pool = createPool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      connectionLimit: options.connectionLimit ?? 10,
      waitForConnections: true,
      namedPlaceholders: false,
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leviathan_documents (
        namespace VARCHAR(120) NOT NULL,
        collection_name VARCHAR(120) NOT NULL,
        document_id VARCHAR(120) NOT NULL,
        document_json LONGTEXT NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        PRIMARY KEY (namespace, collection_name, document_id)
      )
    `);

    return new MysqlDocumentDatabase(pool, options.namespace ?? "default");
  }

  private async loadDocument(collection: string, id: string) {
    const [rows] = await this.pool.query(
      `
        SELECT document_json, created_at, updated_at
        FROM leviathan_documents
        WHERE namespace = ? AND collection_name = ? AND document_id = ?
        LIMIT 1
      `,
      [this.namespace, collection, id],
    );

    const row = (
      rows as Array<{
        document_json: string;
        created_at: Date | string;
        updated_at: Date | string;
      }>
    )[0];
    if (!row) {
      return null;
    }

    return {
      value: JSON.parse(row.document_json) as Record<string, unknown>,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString(),
    } satisfies StoredDocument;
  }

  private async saveDocument(
    collection: string,
    id: string,
    value: Record<string, unknown>,
    options?: SetOptions,
  ) {
    const current = await this.loadDocument(collection, id);
    const merged = options?.merge ? shallowMerge(current?.value, value) : value;
    const createdAt = current?.createdAt ?? nowIso();
    const updatedAt = nowIso();

    await this.pool.query(
      `
        INSERT INTO leviathan_documents (
          namespace,
          collection_name,
          document_id,
          document_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          document_json = VALUES(document_json),
          updated_at = VALUES(updated_at)
      `,
      [
        this.namespace,
        collection,
        id,
        JSON.stringify(merged),
        createdAt.slice(0, 23).replace("T", " "),
        updatedAt.slice(0, 23).replace("T", " "),
      ],
    );
  }

  collection(name: string): CollectionReference {
    return {
      doc: (id) => ({
        get: async () => {
          const record = await this.loadDocument(name, id);
          return {
            id,
            exists: Boolean(record),
            data: () => record?.value,
            ref: {
              set: async (value, options) => {
                await this.saveDocument(name, id, value, options);
              },
              delete: async () => {
                await this.pool.query(
                  `
                    DELETE FROM leviathan_documents
                    WHERE namespace = ? AND collection_name = ? AND document_id = ?
                  `,
                  [this.namespace, name, id],
                );
              },
            },
          };
        },
        set: async (value, options) => {
          await this.saveDocument(name, id, value, options);
        },
        delete: async () => {
          await this.pool.query(
            `
              DELETE FROM leviathan_documents
              WHERE namespace = ? AND collection_name = ? AND document_id = ?
            `,
            [this.namespace, name, id],
          );
        },
      }),
      get: async () => {
        const [rows] = await this.pool.query(
          `
            SELECT document_id, document_json
            FROM leviathan_documents
            WHERE namespace = ? AND collection_name = ?
            ORDER BY document_id ASC
          `,
          [this.namespace, name],
        );

        return {
          docs: (
            rows as Array<{
              document_id: string;
              document_json: string;
            }>
          ).map((row) => ({
            id: row.document_id,
            exists: true,
            data: () =>
              JSON.parse(row.document_json) as Record<string, unknown>,
            ref: {
              set: async (value, options) => {
                await this.saveDocument(name, row.document_id, value, options);
              },
              delete: async () => {
                await this.pool.query(
                  `
                    DELETE FROM leviathan_documents
                    WHERE namespace = ? AND collection_name = ? AND document_id = ?
                  `,
                  [this.namespace, name, row.document_id],
                );
              },
            },
          })),
        };
      },
    };
  }

  async close() {
    await this.pool.end();
  }
}

export const createDocumentDatabase = async (
  options: DocumentDatabaseOptions,
) => {
  if (options.driver === "memory") {
    return new MemoryDocumentDatabase(options.namespace);
  }

  return MysqlDocumentDatabase.create(options);
};

export const generateSessionId = () => randomUUID();

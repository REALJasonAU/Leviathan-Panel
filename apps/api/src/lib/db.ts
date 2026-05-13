import { config } from "../config.js";
import {
  createDocumentDatabase,
  type DocumentDatabase,
} from "./document-db.js";

type QueryDocument = {
  id: string;
  data: () => Record<string, unknown> | undefined;
  ref: {
    set: (
      value: Record<string, unknown>,
      options?: { merge?: boolean },
    ) => Promise<void>;
    delete: () => Promise<void>;
  };
};

type QuerySnapshot = {
  docs: QueryDocument[];
};

type CollectionQuery = {
  doc: (id: string) => {
    get: () => Promise<{
      id: string;
      exists: boolean;
      data: () => Record<string, unknown> | undefined;
    }>;
    set: (
      value: Record<string, unknown>,
      options?: { merge?: boolean },
    ) => Promise<void>;
    delete: () => Promise<void>;
  };
  get: () => Promise<QuerySnapshot>;
  where: (field: string, operator: "==", value: unknown) => CollectionQuery;
  orderBy: (field: string, direction?: "asc" | "desc") => CollectionQuery;
  limit: (count: number) => CollectionQuery;
};

type DocumentStoreCompat = {
  collection: (name: string) => CollectionQuery;
  close: () => Promise<void>;
};

const compareValues = (left: unknown, right: unknown) => {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
};

const createQuery = (
  database: DocumentDatabase,
  collectionName: string,
  filters: Array<{ field: string; value: unknown }> = [],
  ordering: { field: string; direction: "asc" | "desc" } | null = null,
  take: number | null = null,
): CollectionQuery => ({
  doc: (id) => ({
    get: async () => database.collection(collectionName).doc(id).get(),
    set: async (value, options) =>
      database.collection(collectionName).doc(id).set(value, options),
    delete: async () => database.collection(collectionName).doc(id).delete(),
  }),
  get: async () => {
    const snapshot = await database.collection(collectionName).get();
    let docs = snapshot.docs;

    for (const filter of filters) {
      docs = docs.filter(
        (doc) => (doc.data()?.[filter.field] ?? null) === filter.value,
      );
    }

    if (ordering) {
      docs = [...docs].sort((left, right) => {
        const comparison = compareValues(
          left.data()?.[ordering.field],
          right.data()?.[ordering.field],
        );
        return ordering.direction === "asc" ? comparison : comparison * -1;
      });
    }

    if (typeof take === "number") {
      docs = docs.slice(0, take);
    }

    return { docs };
  },
  where: (field, operator, value) => {
    if (operator !== "==") {
      throw new Error(`Unsupported query operator: ${operator}`);
    }
    return createQuery(
      database,
      collectionName,
      [...filters, { field, value }],
      ordering,
      take,
    );
  },
  orderBy: (field, direction = "asc") =>
    createQuery(database, collectionName, filters, { field, direction }, take),
  limit: (count) =>
    createQuery(database, collectionName, filters, ordering, count),
});

const createDocumentStoreCompat = (
  database: DocumentDatabase,
): DocumentStoreCompat => ({
  collection: (name) => createQuery(database, name),
  close: () => database.close(),
});

const createDatabase = async () => {
  if (config.DB_DRIVER === "memory") {
    return createDocumentDatabase({
      driver: "memory",
      namespace: config.DB_NAMESPACE,
    });
  }

  return createDocumentDatabase({
    driver: "mysql",
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    namespace: config.DB_NAMESPACE,
  });
};

const documentDatabase = await createDatabase();
export const databaseEnabled = documentDatabase !== null;
export const firestore = createDocumentStoreCompat(documentDatabase!);
export const closeDatabase = async () => {
  await firestore.close();
};

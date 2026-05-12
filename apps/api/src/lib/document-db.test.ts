import { afterEach, describe, expect, it } from "vitest";

import { createDocumentDatabase } from "./document-db.js";

describe("document database", () => {
  const databases: Array<Awaited<ReturnType<typeof createDocumentDatabase>>> =
    [];

  afterEach(async () => {
    while (databases.length > 0) {
      await databases.pop()?.close();
    }
  });

  it("stores, merges, lists, and deletes collection documents in memory mode", async () => {
    const db = await createDocumentDatabase({
      driver: "memory",
      namespace: "api-doc-test",
    });
    databases.push(db);

    await db
      .collection("users")
      .doc("u_1")
      .set({
        uid: "u_1",
        displayName: "Leviathan Admin",
        roleIds: ["admin"],
      });

    await db.collection("users").doc("u_1").set(
      {
        email: "admin@example.com",
      },
      { merge: true },
    );

    const snapshot = await db.collection("users").doc("u_1").get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toMatchObject({
      uid: "u_1",
      displayName: "Leviathan Admin",
      email: "admin@example.com",
    });

    const collection = await db.collection("users").get();
    expect(collection.docs).toHaveLength(1);
    expect(collection.docs[0]?.id).toBe("u_1");

    await db.collection("users").doc("u_1").delete();

    const deleted = await db.collection("users").doc("u_1").get();
    expect(deleted.exists).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("api integration", () => {
  beforeEach(() => {
    process.env.MOCK_AUTH = "true";
    process.env.MOCK_DATA = "true";
    process.env.PANEL_ORIGIN = "http://localhost:5173";
    vi.resetModules();
  });

  it("creates a node in mock mode", async () => {
    const { buildApp } = await import("./app.js");
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/nodes",
      headers: {
        authorization: "Bearer dev-admin",
      },
      payload: {
        name: "Test Node",
        region: "local",
        publicAddress: "127.0.0.1",
        baseUrl: "http://localhost:4000",
        capabilities: ["docker"],
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json() as {
      node: { name: string };
      bootstrapToken: string;
    };
    expect(payload.node.name).toBe("Test Node");
    expect(payload.bootstrapToken.startsWith("nd_bootstrap_")).toBe(true);

    await app.close();
  });

  it("authenticates scoped API keys and supports revocation", async () => {
    const { buildApp } = await import("./app.js");
    const app = await buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: {
        authorization: "Bearer dev-admin",
      },
      payload: {
        name: "Integration key",
        scopes: ["users.view"],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      record: { id: string; keyPrefix: string; hashedKey?: string };
      plainTextKey: string;
    };
    expect(created.plainTextKey.startsWith("lvk_")).toBe(true);
    expect(created.record.keyPrefix).toBe(created.plainTextKey.slice(0, 12));
    expect(created.record.hashedKey).toBeUndefined();

    const usersResponse = await app.inject({
      method: "GET",
      url: "/v1/users",
      headers: {
        authorization: `Bearer ${created.plainTextKey}`,
      },
    });
    expect(usersResponse.statusCode).toBe(200);

    const forbiddenResponse = await app.inject({
      method: "GET",
      url: "/v1/nodes",
      headers: {
        authorization: `Bearer ${created.plainTextKey}`,
      },
    });
    expect(forbiddenResponse.statusCode).toBe(403);

    const revokeResponse = await app.inject({
      method: "DELETE",
      url: `/v1/api-keys/${created.record.id}`,
      headers: {
        authorization: "Bearer dev-admin",
      },
    });
    expect(revokeResponse.statusCode).toBe(200);

    const revokedResponse = await app.inject({
      method: "GET",
      url: "/v1/users",
      headers: {
        authorization: `Bearer ${created.plainTextKey}`,
      },
    });
    expect(revokedResponse.statusCode).toBe(401);

    await app.close();
  });

  it("validates billing webhook provider and signature scaffolding", async () => {
    const { buildApp } = await import("./app.js");
    const app = await buildApp();

    const missingSignature = await app.inject({
      method: "POST",
      url: "/v1/integrations/billing/stripe/webhook",
      payload: {
        provider: "stripe",
        event: "customer.subscription.created",
        payload: {},
      },
    });
    expect(missingSignature.statusCode).toBe(401);

    const accepted = await app.inject({
      method: "POST",
      url: "/v1/integrations/billing/stripe/webhook",
      headers: {
        "stripe-signature": "test",
      },
      payload: {
        provider: "stripe",
        event: "customer.subscription.created",
        payload: {},
      },
    });
    expect(accepted.statusCode).toBe(200);

    await app.close();
  });
});

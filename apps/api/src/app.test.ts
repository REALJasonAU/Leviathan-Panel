import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("api integration", () => {
  beforeEach(() => {
    process.env.DB_DRIVER = "memory";
    process.env.PANEL_ORIGIN = "http://localhost:5173";
    vi.resetModules();
  });

  const loginAsAdmin = async (app: FastifyInstance) => {
    const { store } = await import("./lib/store.js");
    await store.createLocalUser({
      username: "admin",
      email: "admin@example.com",
      password: "abyss-admin-password",
      roleIds: ["admin"],
      displayName: "Admin",
    });

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        identifier: "admin",
        password: "abyss-admin-password",
      },
    });

    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find(
      (entry) => entry.name === "leviathan_session",
    );
    expect(cookie?.value).toBeTruthy();
    return cookie?.value ?? "";
  };

  it("creates a node with a real admin session", async () => {
    const { buildApp } = await import("./app.js");
    const app = await buildApp();
    const sessionCookie = await loginAsAdmin(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/nodes",
      cookies: {
        leviathan_session: sessionCookie,
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
    const sessionCookie = await loginAsAdmin(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      cookies: {
        leviathan_session: sessionCookie,
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
      cookies: {
        leviathan_session: sessionCookie,
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

  it("logs in with local credentials and resolves the cookie-backed session", async () => {
    process.env.SESSION_COOKIE_NAME = "leviathan_session";
    vi.resetModules();

    const [{ buildApp }, { store }] = await Promise.all([
      import("./app.js"),
      import("./lib/store.js"),
    ]);
    const app = await buildApp();

    await store.createLocalUser({
      username: "admin",
      email: "admin@example.com",
      password: "abyss-admin-password",
      roleIds: ["admin"],
      displayName: "Admin",
    });

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        identifier: "admin",
        password: "abyss-admin-password",
      },
    });

    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find(
      (entry) => entry.name === "leviathan_session",
    );
    expect(cookie?.value).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      cookies: {
        leviathan_session: cookie?.value ?? "",
      },
    });

    expect(me.statusCode).toBe(200);
    const payload = me.json() as {
      user: { email?: string; displayName: string };
    };
    expect(payload.user.email).toBe("admin@example.com");
    expect(payload.user.displayName).toBe("Admin");

    await app.close();
  });
});

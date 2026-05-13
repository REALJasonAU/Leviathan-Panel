import { expect, test, type Page } from "@playwright/test";

const adminIdentifier = "e2e-admin";
const adminPassword = "e2e-password";

const loginAsAdmin = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username or Email").fill(adminIdentifier);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in to Leviathan" }).click();
  await page.waitForURL(/#overview/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
};

test("admin can load dashboard and see Leviathan navigation", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await expect(page.locator(".sidebar-nav__brand strong")).toHaveText(
    "Leviathan",
  );
  await expect(page.locator('a[href="#servers"]').first()).toBeVisible();
  await expect(page.locator('a[href="#nodes"]').first()).toBeVisible();
  await expect(page.locator('a[href="#cloudflare"]').first()).toBeVisible();
  await expect(page.locator('a[href="#plugins"]').first()).toBeVisible();
});

test("admin can create a node, parse env metadata, and provision a server", async ({
  page,
}) => {
  const serverName = `Release Fleet ${Date.now()}`;
  const nodeName = `Node ${Date.now()}`;

  await loginAsAdmin(page);

  await page.locator('a[href="#nodes"]').first().click();
  await expect(page.getByRole("heading", { name: "Nodes" })).toBeVisible();
  const createNodeCard = page.locator("#create-node-surface");
  await createNodeCard.getByLabel("Name").fill(nodeName);
  await createNodeCard.getByLabel("Region").fill("local");
  await createNodeCard.getByLabel("Public Address").fill("203.0.113.44");
  await createNodeCard
    .getByLabel("Panel Base URL")
    .fill("http://localhost:4000");
  await createNodeCard.getByLabel("Capabilities").fill("docker,backups");
  await createNodeCard.getByRole("button", { name: "Create Node" }).click();
  await expect(
    page.getByRole("dialog", {
      name: new RegExp(`Bootstrap token for ${nodeName}`),
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog", {
      name: new RegExp(`Bootstrap token for ${nodeName}`),
    })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Config" }).first(),
  ).toBeVisible();

  await page.locator('a[href="#templates"]').first().click();
  const envImportTextarea = page.locator("textarea").first();
  await envImportTextarea.fill("APP_PORT=25565\nRCON_PASSWORD=\n");
  await expect(envImportTextarea).toHaveValue(/APP_PORT/);
  const envImportResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/v1/templates/import-env-example") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Parse Import" }).click();
  await envImportResponse;
  await expect(page.locator(".env-preview .env-row").first()).toContainText(
    "APP_PORT",
  );
  const createTemplateCard = page.locator("#create-template-surface");
  await createTemplateCard.getByLabel("ID").fill("tpl_release_fleet");
  await createTemplateCard.getByLabel("Name").fill("Release Fleet Template");
  await createTemplateCard.getByLabel("Category").fill("docker");
  await createTemplateCard
    .getByLabel("Description")
    .fill("Template for release fleet workloads");
  await createTemplateCard.getByLabel("Docker Images").fill("node:20-alpine");
  await createTemplateCard.getByLabel("Startup Command").fill("npm start");
  await createTemplateCard
    .getByRole("button", { name: "Save Template" })
    .click();
  await expect(page.getByText("Release Fleet Template")).toBeVisible();

  await page.locator('.sidebar-nav a[href="#servers"]').first().click();
  await expect(page).toHaveURL(/#servers/);
  const createServerCard = page.locator("#create-server-surface");
  await expect(createServerCard).toBeVisible({ timeout: 10000 });
  await expect(createServerCard.getByLabel("Template")).not.toHaveValue("");
  await expect(createServerCard.getByLabel("Node")).not.toHaveValue("");
  await createServerCard.getByLabel("Name").fill(serverName);
  await createServerCard.getByRole("button", { name: "Create Server" }).click();
  const fleetEntry = page
    .locator("button.server-list-item")
    .filter({ hasText: serverName });
  await expect(fleetEntry).toBeVisible();
  await expect(page.getByText(serverName).first()).toBeVisible();
});

test("admin can create an API key and dry-run a Cloudflare route", async ({
  page,
}) => {
  const routeHostname = `play-${Date.now()}.example.com`;

  await loginAsAdmin(page);

  await page.locator('.sidebar-nav a[href="#settings"]').first().click();
  await expect(page).toHaveURL(/#settings/);
  const settingsCard = page.locator("#settings-surface");
  await expect(settingsCard).toBeVisible({ timeout: 10000 });
  await settingsCard.getByLabel("Cloudflare Account ID").fill("acct_test");
  await settingsCard.getByLabel("Cloudflare Zone ID").fill("zone_test");
  await settingsCard.getByLabel("Cloudflare Tunnel ID").fill("tunnel_test");
  await settingsCard.getByLabel("Cloudflare API Token").fill("token_test");
  await page.getByRole("button", { name: "Save Settings" }).click();

  await page.locator('.sidebar-nav a[href="#api-keys"]').first().click();
  const createApiKeyCard = page.locator("#create-api-key-surface");
  await createApiKeyCard.getByLabel("API Key Name").fill("E2E Key");
  await expect(createApiKeyCard.getByLabel("API Key Name")).toHaveValue(
    "E2E Key",
  );
  await createApiKeyCard
    .getByRole("button", { name: "Create API Key" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Leviathan API key created" }),
  ).toBeVisible();
  await expect(
    page.locator(".secret-reveal__token").filter({ hasText: /^lvk_/ }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Leviathan API key created" })
    .getByRole("button", { name: "Close", exact: true })
    .click();

  await page.locator('.sidebar-nav a[href="#cloudflare"]').first().click();
  await page.getByLabel("Hostname").fill(routeHostname);
  await page.getByLabel("Service").fill("http://127.0.0.1:25565");
  await page.getByLabel("Tunnel ID").fill("tunnel_test");
  await page.getByLabel("Zone ID").fill("zone_test");
  const createRouteResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/v1/cloudflare/routes") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Route" }).click();
  await createRouteResponse;
  await expect(page.getByText(routeHostname)).toBeVisible();

  const dryRunResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/v1/cloudflare/routes/") &&
      response.url().endsWith("/sync") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Dry Run" }).last().click();
  await dryRunResponse;
  await expect(page.getByText(routeHostname)).toBeVisible();
});

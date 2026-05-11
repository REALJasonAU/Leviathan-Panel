import { expect, test, type Page } from "@playwright/test";

const loginAsMockAdmin = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use Mock Admin" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
};

test("mock admin can load dashboard and see Leviathan navigation", async ({
  page,
}) => {
  await loginAsMockAdmin(page);
  await expect(page.locator(".sidebar-nav__brand strong")).toHaveText(
    "Leviathan",
  );
  await expect(page.locator('a[href="#servers"]').first()).toBeVisible();
  await expect(page.locator('a[href="#nodes"]').first()).toBeVisible();
  await expect(page.locator('a[href="#cloudflare"]').first()).toBeVisible();
  await expect(page.locator('a[href="#plugins"]').first()).toBeVisible();
});

test("mock admin can create a node, parse env metadata, and provision a server", async ({
  page,
}) => {
  const serverName = `Release Fleet ${Date.now()}`;
  const nodeName = `Node ${Date.now()}`;

  await loginAsMockAdmin(page);

  await page.locator('a[href="#nodes"]').first().click();
  await expect(page.getByRole("heading", { name: "Nodes" })).toBeVisible();
  const createNodeCard = page.locator("#create-node-surface");
  await createNodeCard.getByLabel("Name").fill(nodeName);
  await createNodeCard.getByLabel("Public Address").fill("203.0.113.44");
  await createNodeCard.getByRole("button", { name: "Create Node" }).click();
  await expect(
    page.getByRole("dialog", { name: new RegExp(`Bootstrap token for ${nodeName}`) }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: new RegExp(`Bootstrap token for ${nodeName}`) })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Config" }).first(),
  ).toBeVisible();

  await page.locator('a[href="#templates"]').first().click();
  await page.getByRole("button", { name: "Parse Import" }).click();
  await expect(page.getByText("APP_PORT")).toBeVisible();

  await page.locator('a[href="#servers"]').first().click();
  const createServerCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Create Server" }),
  });
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

test("mock admin can create an API key and dry-run a Cloudflare route", async ({
  page,
}) => {
  const routeHostname = `play-${Date.now()}.example.com`;

  await loginAsMockAdmin(page);

  await page.locator('a[href="#settings"]').first().click();
  await page.getByLabel("Cloudflare Account ID").fill("acct_test");
  await page.getByLabel("Cloudflare Zone ID").fill("zone_test");
  await page.getByLabel("Cloudflare Tunnel ID").fill("tunnel_test");
  await page.getByLabel("Cloudflare API Token").fill("token_test");
  await page.getByRole("button", { name: "Save Settings" }).click();

  await page.locator('a[href="#api-keys"]').first().click();
  await page
    .locator("#create-api-key-surface")
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

  await page.locator('a[href="#cloudflare"]').first().click();
  await page.getByLabel("Hostname").fill(routeHostname);
  await page.getByLabel("Tunnel ID").fill("tunnel_test");
  await page.getByLabel("Zone ID").fill("zone_test");
  await page.getByRole("button", { name: "Create Route" }).click();
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

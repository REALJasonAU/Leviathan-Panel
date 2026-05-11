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
  await expect(page.getByText("Leviathan", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Servers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nodes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cloudflare" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plugins" })).toBeVisible();
});

test("mock admin can create a node, parse env metadata, and provision a server", async ({
  page,
}) => {
  const serverName = `Release Fleet ${Date.now()}`;

  await loginAsMockAdmin(page);

  await page.getByRole("link", { name: "Nodes" }).click();
  await expect(page.getByRole("heading", { name: "Nodes" })).toBeVisible();
  await page.getByRole("button", { name: "Create Node" }).click();
  await expect(page.getByText("Bootstrap token:")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Config" }).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Templates" }).click();
  await page.getByRole("button", { name: "Parse Import" }).click();
  await expect(page.getByText("APP_PORT")).toBeVisible();

  await page.getByRole("link", { name: "Servers" }).click();
  const createServerCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Create Server" }),
  });
  await expect(createServerCard.getByLabel("Template")).toHaveValue(
    "tpl_minecraft_java",
  );
  await expect(createServerCard.getByLabel("Node")).toHaveValue(/node_/);
  await createServerCard.getByLabel("Name").fill(serverName);
  await page.getByRole("button", { name: "Create Server" }).click();
  const fleetEntry = page.getByRole("button", { name: new RegExp(serverName) });
  await expect(fleetEntry).toBeVisible();
  await expect(page.getByText("Node node_")).toBeVisible();
});

test("mock admin can create an API key and dry-run a Cloudflare route", async ({
  page,
}) => {
  const routeHostname = `play-${Date.now()}.example.com`;

  await loginAsMockAdmin(page);

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Cloudflare Account ID").fill("acct_test");
  await page.getByLabel("Cloudflare Zone ID").fill("zone_test");
  await page.getByLabel("Cloudflare Tunnel ID").fill("tunnel_test");
  await page.getByLabel("Cloudflare API Token").fill("token_test");
  await page.getByRole("button", { name: "Save Settings" }).click();

  await page.getByRole("link", { name: "API Keys" }).click();
  await page.getByRole("button", { name: "Create API Key" }).click();
  await expect(
    page.locator("p.token-box").filter({ hasText: /^lvk_/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Cloudflare" }).click();
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

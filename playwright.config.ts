import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:5400",
  },
  webServer: [
    {
      command: "pnpm --filter @voltan/api dev",
      url: "http://127.0.0.1:4400/health",
      timeout: 180_000,
      reuseExistingServer: true,
      env: {
        DB_DRIVER: "memory",
        BOOTSTRAP_ADMIN_ON_START: "true",
        ADMIN_USERNAME: "e2e-admin",
        ADMIN_EMAIL: "e2e-admin@example.test",
        ADMIN_PASSWORD: "e2e-password",
        PANEL_ORIGIN: "http://127.0.0.1:5400",
        PORT: "4400",
        RATE_LIMIT_MAX: "1000",
      },
    },
    {
      command:
        "pnpm --filter @voltan/panel dev -- --host 127.0.0.1 --port 5400 --strictPort",
      url: "http://127.0.0.1:5400",
      timeout: 180_000,
      reuseExistingServer: true,
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:4400",
      },
    },
  ],
});

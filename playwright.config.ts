import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: [
    {
      command: "pnpm --filter @voltan/api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      env: {
        DB_DRIVER: "memory",
        BOOTSTRAP_ADMIN_ON_START: "true",
        ADMIN_USERNAME: "e2e-admin",
        ADMIN_EMAIL: "e2e-admin@example.test",
        ADMIN_PASSWORD: "e2e-password",
        PANEL_ORIGIN: "http://localhost:5173",
        RATE_LIMIT_MAX: "1000",
      },
    },
    {
      command: "pnpm --filter @voltan/panel dev -- --host 127.0.0.1",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      env: {
        VITE_API_BASE_URL: "http://localhost:4000",
      },
    },
  ],
});

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
      reuseExistingServer: false,
      env: {
        MOCK_AUTH: "true",
        MOCK_DATA: "true",
        PANEL_ORIGIN: "http://localhost:5173",
        RATE_LIMIT_MAX: "1000",
      },
    },
    {
      command: "pnpm --filter @voltan/panel dev -- --host 127.0.0.1",
      url: "http://localhost:5173",
      reuseExistingServer: false,
      env: {
        VITE_USE_MOCK_AUTH: "true",
        VITE_API_BASE_URL: "http://localhost:4000",
      },
    },
  ],
});

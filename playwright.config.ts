import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// E2E runs against a production build and a writable demo account (DEMO_LOGIN_ENABLED=true, DEMO_READ_ONLY unset).
// Locally that's the Neon "dev" branch from .env.local; in CI it's the Neon "ci" branch (see .github/workflows).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // tests share the demo account
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? `pnpm start -p ${PORT}` : `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { AUTH_TRUST_HOST: "true", DEMO_LOGIN_ENABLED: "true", DEMO_READ_ONLY: "" },
  },
});

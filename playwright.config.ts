import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  "/etc/profiles/per-user/rafiq/bin/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://127.0.0.1:5173" },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: existsSync(chromiumPath)
          ? { executablePath: chromiumPath }
          : undefined,
      },
    },
    {
      name: "mobile-chrome",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        launchOptions: existsSync(chromiumPath)
          ? { executablePath: chromiumPath }
          : undefined,
      },
    },
    {
      name: "mobile-iphone",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        launchOptions: existsSync(chromiumPath)
          ? { executablePath: chromiumPath }
          : undefined,
      },
    },
  ],
});

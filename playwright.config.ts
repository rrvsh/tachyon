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
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: existsSync(chromiumPath)
          ? { executablePath: chromiumPath }
          : undefined,
      },
    },
  ],
});

import { expect, test } from "@playwright/test";

function uniqueId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}`.slice(0, 8).padEnd(8, "x");
}

test("debug mode can create and stream a session", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0");
  await expect(page.getByTestId("blank")).toBeVisible();
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.user")).toContainText("hello");
  await expect(page.locator(".message.assistant")).toContainText(
    "Debug response",
  );
});

test("abort finalizes only the viewed debug request", async ({ page }) => {
  await page.goto(
    "/?debug=1&debugDelay=100&debugText=one%20two%20three%20four%20five",
  );
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("abort me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(
    page.getByRole("button", { name: "Abort", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abort", exact: true }).click();
  await expect(page.locator(".message.assistant small")).toHaveText("final");
});

test("branch controls switch between edited message siblings", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=first");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("branch base");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("first");

  page.once("dialog", async (dialog) => dialog.accept("branch edited"));
  await page
    .locator(".message.user")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.locator(".message.user")).toContainText("branch edited");
  await expect(page.locator(".message.user")).toContainText("2/2");

  await page.locator(".message.user [data-branch-prev]").click();
  await expect(page.locator(".message.user")).toContainText("branch base");
  await expect(page.locator(".message.user")).toContainText("1/2");
});

test("import and export flow uses canonical JSON records", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=exported");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("export me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("exported");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("openrouter-static-export");

  const sessionId = uniqueId("imps");
  const messageId = `m_${uniqueId("msg")}`;
  const imported = {
    version: 1,
    exportedAt: Date.now(),
    sessions: [
      {
        id: sessionId,
        title: "Imported E2E Session",
        createdAt: 1,
        updatedAt: 1,
        archived: false,
        rootMessageId: messageId,
      },
    ],
    messages: [
      {
        id: messageId,
        sessionId,
        role: "assistant",
        content: "imported content",
        parentId: null,
        createdAt: 1,
        updatedAt: 1,
        finalized: true,
      },
    ],
    agents: [],
  };
  await page.locator('input[data-action="import"]').setInputFiles({
    name: "import.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.locator(".notices")).toContainText("Imported 2");
  await expect(
    page.getByRole("button", { name: "Imported E2E Session" }),
  ).toBeVisible();
});

test("user scroll intent disables streaming autoscroll", async ({ page }) => {
  const longText = Array.from({ length: 160 }, (_, i) => `token${i}`).join(
    "%20",
  );
  await page.setViewportSize({ width: 900, height: 520 });
  await page.goto(`/?debug=1&debugDelay=12&debugText=${longText}`);
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("long stream");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toBeVisible();

  await page.locator(".conversation").hover();
  await page.mouse.wheel(0, -800);
  await expect
    .poll(() => page.locator("#app").evaluate((el) => el.dataset.autoscroll))
    .toBe("false");

  await page.waitForTimeout(500);
  await expect(
    page.locator("#app").evaluate((el) => el.dataset.autoscroll),
  ).resolves.toBe("false");
});

test("agent form, edit, and settings are functional", async ({ page }) => {
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page
    .locator('form[data-agent-form] input[name="name"]')
    .fill("Agent E2E");
  await page
    .locator('form[data-agent-form] input[name="model"]')
    .fill("model/e2e");
  await page
    .locator("form[data-agent-form]")
    .getByRole("button", { name: "Save agent" })
    .click();

  await expect(page.locator("li", { hasText: "Agent E2E" })).toBeVisible();

  await page
    .locator("li", { hasText: "Agent E2E" })
    .getByRole("button", { name: "Edit agent" })
    .click();
  await page
    .locator('form[data-agent-form] input[name="name"]')
    .fill("Agent Edited");
  await page
    .locator('form[data-agent-form] input[name="model"]')
    .fill("model/edited");
  await page
    .locator("form[data-agent-form]")
    .getByRole("button", { name: "Save agent" })
    .click();

  await expect(page.locator("li", { hasText: "Agent Edited" })).toBeVisible();
});

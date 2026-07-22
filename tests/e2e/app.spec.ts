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

test("right sidebar sessions collapses and persists", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0");
  await expect(page.getByRole("button", { name: "new chat" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "sessions" })).toBeVisible();
  await page.getByRole("button", { name: "collapse right sidebar" }).click();
  await expect(page.getByRole("button", { name: "sessions" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "expand right sidebar" }),
  ).toHaveText("<|");
  await page.reload();
  await expect(page.getByRole("button", { name: "sessions" })).toHaveCount(0);
  await page.getByRole("button", { name: "expand right sidebar" }).click();
  await expect(page.getByRole("button", { name: "sessions" })).toBeVisible();
});

test("ctrl enter sends the prompt", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("keyboard send");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".message.user")).toContainText("keyboard send");
});

test("clicking errors fades and dismisses them", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0&debugError=1");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("error please");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".notices .error")).toContainText(
    "Simulated debug transport error",
  );
  await page.locator(".notices .error").click();
  await expect(page.locator(".notices .error")).toHaveCount(0);
});

test("composer draft survives unrelated request finalization", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=300&debugText=finished");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("start request");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "new chat" })).toBeVisible();
  await page.getByRole("button", { name: "new chat" }).click();
  const composer = page.getByPlaceholder("Message (empty for assistant-only)");
  await composer.fill("draft survives");
  await page.waitForTimeout(450);
  await expect(composer).toHaveValue("draft survives");
});

test("ctrl enter halts an inflight prompt", async ({ page }) => {
  await page.goto(
    "/?debug=1&debugDelay=100&debugText=one%20two%20three%20four%20five",
  );
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("halt with keyboard");
  await page.keyboard.press("Control+Enter");
  await expect(
    page.getByRole("button", { name: "Abort", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+Enter");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
});

test("reasoning streams into the thinking block before content", async ({
  page,
}) => {
  await page.goto(
    "/?debug=1&debugDelay=60&debugReasoning=thinking%20live&debugText=answer",
  );
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("reason first");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".thinking-block")).toContainText("thinking");
  const assistantContent = page.locator(
    ".message.assistant [data-message-content]",
  );
  await expect(assistantContent).not.toContainText("answer");
  await expect(assistantContent).toContainText("answer");
});

test("open thinking default controls only initial thinking state", async ({
  page,
}) => {
  await page.goto(
    "/?debug=1&debugDelay=80&debugReasoning=one%20two%20three%20four&debugText=answer",
  );
  await page.getByLabel("thinking blocks").selectOption("closed");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("closed thinking");
  await page.getByRole("button", { name: "Send" }).click();
  const block = page.locator(".thinking-block");
  await expect(block).toContainText("one");
  await expect(block).not.toHaveAttribute("open", "");
  await block.locator("summary").click();
  await expect(block).toHaveAttribute("open", "");
  await expect(block).toContainText("three");
  await expect(block).toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
  await expect(block).toHaveAttribute("open", "");
});

test("thinking block can stay closed while streaming", async ({ page }) => {
  await page.goto(
    "/?debug=1&debugDelay=80&debugReasoning=one%20two%20three%20four&debugText=answer",
  );
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("close thinking");
  await page.getByRole("button", { name: "Send" }).click();
  const block = page.locator(".thinking-block");
  await expect(block).toContainText("one");
  await expect(block).toHaveAttribute("open", "");
  await block.locator("summary").click();
  await expect(block).not.toHaveAttribute("open", "");
  await expect(block).toContainText("three");
  await expect(block).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
  await expect(block).not.toHaveAttribute("open", "");
});

test("streaming assistant messages hide controls until finalized", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=20&debugText=one%20two%20three");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("stream controls");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toBeVisible();
  await expect(
    page.locator(".message.assistant .message-controls"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".message.assistant .message-controls"),
  ).toHaveCount(1);
});

test("inline edit creates variants and branch controls switch siblings", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=first");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("branch base");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("first");

  await page
    .locator(".message.user")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.locator(".message.user textarea")).toHaveValue(
    "branch base",
  );
  await page.locator(".message.user textarea").fill("branch edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".message.user")).toContainText("branch edited");
  await expect(page.locator(".message.user")).toContainText("2/2");
  await expect(page.locator(".message.assistant")).toContainText("first");

  await page.locator(".message.user [data-branch-prev]").click();
  await expect(page.locator(".message.user")).toContainText("branch base");
  await expect(page.locator(".message.user")).toContainText("1/2");
});

test("copy and tombstone delete keep descendants visible", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?debug=1&debugDelay=0&debugText=child");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("delete parent");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("child");

  await page
    .locator(".message.user")
    .getByRole("button", { name: "Copy", exact: true })
    .click();
  await expect(
    page.locator(".message.user").getByRole("button", { name: "copied!" }),
  ).toBeVisible();

  await page
    .locator(".message.user")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".message.user")).toContainText("deleted message");
  await expect(page.locator(".message.user")).toContainText(
    "restore deleted message",
  );
  await expect(page.locator(".message.assistant")).toContainText("child");

  await page.getByRole("button", { name: "Restore deleted message" }).click();
  await expect(page.locator(".message.user")).toContainText("delete parent");
});

test("copy conversation uses visible content and omits deleted thinking", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/?debug=1&debugDelay=0&debugText=%3Cthink%3Ehidden%3C%2Fthink%3Evisible",
  );
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("copy thread");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("visible");
  await expect(page.locator(".thinking-block")).toContainText("hidden");

  await page
    .locator(".message.user")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page
    .locator(".composer-flow-controls")
    .getByRole("button", { name: "Copy conversation", exact: true })
    .click();
  await expect(
    page
      .locator(".composer-flow-controls")
      .getByRole("button", { name: "copied!" }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("session:");
  expect(copied).not.toContain("messages:");
  expect(copied).toContain("assistant:\nvisible");
  expect(copied).not.toContain("copy thread");
  expect(copied).not.toContain("hidden");
  expect(copied).not.toContain("deleted message");
});

test("import conflict choices resolve agent rows", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0");
  const agentId = "agent-conflict";
  const localAgent = {
    id: agentId,
    name: "Conflict Agent",
    model: "local-model",
    systemPrompt: "local prompt",
    params: {},
    createdAt: 1,
    updatedAt: 2,
    archived: false,
  };
  await page.evaluate(async (agent) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("tachyon-chat", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("agents", "readwrite");
        tx.objectStore("agents").put(agent);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, localAgent);

  await page.getByRole("button", { name: "data" }).click();
  await page.locator('input[data-action="import"]').setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        sessions: [],
        messages: [],
        agents: [{ ...localAgent, model: "incoming-model", updatedAt: 2 }],
      }),
    ),
  });

  const conflict = page.locator(".import-record", {
    hasText: "Conflict Agent",
  });
  await expect(conflict).toContainText("conflict");
  await conflict.getByRole("button", { name: "keep local" }).click();
  await expect(conflict).toContainText("resolved");
  await expect(conflict).toContainText("selected: keep local");
  await conflict.getByRole("button", { name: "use incoming" }).click();
  await expect(conflict).toContainText("selected: use incoming");
  await conflict.getByRole("button", { name: "skip" }).click();
  await expect(conflict).toContainText("selected: skip");
  await expect(page.getByRole("button", { name: "merge" })).toBeEnabled();
});

test("import and export flow uses canonical JSON records", async ({ page }) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=exported");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("export me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("exported");

  await page.getByRole("button", { name: "data" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "export data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("tachyon-export");

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
  await expect(page.locator(".import-review")).toContainText("import preview");
  await expect(page.locator(".import-review")).toContainText("sessions");
  await page.getByRole("button", { name: "merge" }).click();
  await expect(page.locator(".notices")).toContainText("Imported 2");
  await page.getByRole("button", { name: "sessions" }).click();
  await expect(
    page.getByRole("button", { name: "Imported E2E Session" }),
  ).toBeVisible();
});

test("composer controls sit below the last message outside the pinned composer", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=controls below");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("place controls");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText(
    "controls below",
  );

  await expect(page.locator(".composer .composer-context")).toHaveCount(0);
  await expect(page.locator(".composer-flow-controls")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const lastMessage = document.querySelector(
          ".messages .message:last-child",
        );
        const controls = document.querySelector(".composer-flow-controls");
        const composer = document.querySelector(".composer");
        if (!lastMessage || !controls || !composer) return null;
        const messageRect = lastMessage.getBoundingClientRect();
        const controlsRect = controls.getBoundingClientRect();
        const composerRect = composer.getBoundingClientRect();
        return {
          controlsBelowMessage: controlsRect.top >= messageRect.bottom,
          controlsAboveComposer: controlsRect.bottom <= composerRect.top,
        };
      }),
    )
    .toEqual({ controlsBelowMessage: true, controlsAboveComposer: true });
});

test("desktop back to top sits below prompt and scrolls conversation", async ({
  page,
}) => {
  const longText = Array.from({ length: 180 }, (_, i) => `line ${i}`).join(
    "%0A",
  );
  await page.setViewportSize({ width: 900, height: 520 });
  await page.goto(`/?debug=1&debugDelay=0&debugText=${longText}`);
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("long answer");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("line 179");

  const backToTop = page.locator(".composer [data-back-to-top]");
  await expect(backToTop).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const button = document.querySelector(".composer [data-back-to-top]");
        const composerBox = document.querySelector(".composer-box");
        const mobileButton = document.querySelector(
          ".composer-flow-controls [data-back-to-top]",
        );
        if (!button || !composerBox || !mobileButton) return null;
        const buttonRect = button.getBoundingClientRect();
        const boxRect = composerBox.getBoundingClientRect();
        return {
          desktopBelowPrompt: buttonRect.top >= boxRect.bottom,
          mobileButtonHidden: getComputedStyle(mobileButton).display === "none",
        };
      }),
    )
    .toEqual({ desktopBelowPrompt: true, mobileButtonHidden: true });

  await page.locator(".conversation").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect
    .poll(() => page.locator(".conversation").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await backToTop.click();
  await expect
    .poll(() => page.locator(".conversation").evaluate((el) => el.scrollTop))
    .toBe(0);
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

test("focused composer input survives background rerenders", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  const composer = page.getByPlaceholder("Message (empty for assistant-only)");
  await composer.fill("keep my draft");
  await composer.evaluate((textarea: HTMLTextAreaElement) => {
    textarea.setSelectionRange(5, 7);
    window.dispatchEvent(new CustomEvent("app:changed"));
  });

  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue("keep my draft");
  await expect
    .poll(() =>
      composer.evaluate((textarea: HTMLTextAreaElement) => ({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      })),
    )
    .toEqual({ start: 5, end: 7 });
});

test("right sidebar form input survives background rerenders", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "agents" }).click();
  await page.getByRole("button", { name: "create new" }).click();
  const name = page.locator('[data-agent-form] input[name="name"]');
  await name.fill("draft agent");
  await name.evaluate((input: HTMLInputElement) => {
    input.setSelectionRange(2, 7);
    window.dispatchEvent(new CustomEvent("app:changed"));
  });

  await expect(name).toBeFocused();
  await expect(name).toHaveValue("draft agent");
  await expect
    .poll(() =>
      name.evaluate((input: HTMLInputElement) => ({
        start: input.selectionStart,
        end: input.selectionEnd,
      })),
    )
    .toEqual({ start: 2, end: 7 });
});

test("right sidebar scroll survives background rerenders", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "agents" }).click();
  await page.getByRole("button", { name: "create new" }).click();
  await page.locator(".params-grid > summary").click();
  await page.locator(".right-sidebar").evaluate((sidebar) => {
    sidebar
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((details) => {
        details.open = true;
      });
    sidebar.scrollTop = sidebar.scrollHeight;
    window.dispatchEvent(new CustomEvent("app:changed"));
  });

  await expect
    .poll(() => page.locator(".right-sidebar").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
});

test("composer stays pinned when the right sidebar content grows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "agents" }).click();
  await page.getByRole("button", { name: "create new" }).click();
  await page.locator(".params-grid > summary").click();
  await page.locator(".right-sidebar").evaluate((sidebar) => {
    sidebar
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((details) => {
        details.open = true;
      });
  });

  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".composer").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const chat = document
          .querySelector(".chat-panel")!
          .getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          viewport: window.innerHeight,
          width: Math.round(rect.width),
          chatWidth: Math.round(chat.width),
          x: Math.round(rect.x),
          documentFitsViewport:
            document.documentElement.scrollHeight <= window.innerHeight,
        };
      }),
    )
    .toEqual({
      bottom: 720,
      viewport: 720,
      width: 820,
      chatWidth: 820,
      x: 0,
      documentFitsViewport: true,
    });
});

test("agent form, edit, and settings are functional", async ({ page }) => {
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "agents" }).click();
  await page.getByRole("button", { name: "create new" }).click();
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

  await page.getByRole("button", { name: "settings" }).click();
  await expect(page.getByLabel("font")).toHaveValue(
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  );
  await expect(page.getByLabel("font").locator("option")).toHaveCount(7);
  await page.getByRole("button", { name: "save", exact: true }).click();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          "--app-font-family",
        ),
      ),
    )
    .toContain("Inter");
});

import { expect, test } from "@playwright/test";

test("mobile first load keeps composer visible and sidebar collapsed", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0");

  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(
    page.getByPlaceholder("Message (empty for assistant-only)"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "expand right sidebar" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "sessions" })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("mobile sidebar opens as an overlay with usable tabs", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0");

  await page.getByRole("button", { name: "expand right sidebar" }).click();
  await expect(page.getByRole("button", { name: "sessions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "settings" })).toBeVisible();
  await page.getByRole("button", { name: "settings" }).click();
  await expect(page.getByLabel("font")).toBeVisible();

  await expect
    .poll(() =>
      page.locator(".right-sidebar").evaluate((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          position: style.position,
          fillsViewport: Math.round(rect.width) === window.innerWidth,
        };
      }),
    )
    .toEqual({ position: "fixed", fillsViewport: true });

  await page
    .locator(".mobile-sidebar-header")
    .getByRole("button", { name: "close sidebar" })
    .click();
  await expect(page.getByRole("button", { name: "sessions" })).toHaveCount(0);
});

test("mobile can send and keeps composer reachable after a long stream", async ({
  page,
}) => {
  const longText = Array.from({ length: 120 }, (_, i) => `token${i}`).join(
    "%20",
  );
  await page.goto(`/?debug=1&debugDelay=0&debugText=${longText}`);
  const composer = page.getByPlaceholder("Message (empty for assistant-only)");

  await expect(composer).toHaveAttribute("enterkeyhint", "send");
  await composer.fill("hello mobile");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.locator(".message.user")).toContainText("hello mobile");
  await expect(page.locator(".message.assistant")).toContainText("token119");
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
});

test("mobile touch scrolling disables streaming autoscroll only from conversation", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=40&debugText=one%20two%20three%20four");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("touch scroll");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toBeVisible();

  await page.locator(".conversation").dispatchEvent("touchmove");
  await expect
    .poll(() => page.locator("#app").evaluate((el) => el.dataset.autoscroll))
    .toBe("false");
});

test("mobile keyboard inset lifts composer above the occluded area", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0");
  const bottomBefore = await page
    .locator(".composer")
    .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));

  await page.evaluate(() => {
    document.documentElement.style.setProperty("--keyboard-inset", "180px");
  });

  await expect
    .poll(() =>
      page
        .locator(".composer")
        .evaluate((el) => Math.round(el.getBoundingClientRect().bottom)),
    )
    .toBe(bottomBefore - 180);
});

test("mobile message controls are reachable and tap-sized", async ({
  page,
}) => {
  await page.goto("/?debug=1&debugDelay=0&debugText=answer");
  await page
    .getByPlaceholder("Message (empty for assistant-only)")
    .fill("tap controls");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".message.assistant")).toContainText("answer");

  const copy = page
    .locator(".message.user")
    .getByRole("button", { name: "Copy", exact: true });
  await expect(copy).toBeVisible();
  await expect
    .poll(() =>
      copy.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.height >= 44 && rect.width >= 44;
      }),
    )
    .toBe(true);
});

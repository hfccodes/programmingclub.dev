import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const win = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });

/** Drag a window by its title bar to (x, y), in steps so the pointer moves like a hand would. */
async function dragBar(page: Page, name: string, x: number, y: number) {
  const bar = win(page, name).locator("header");
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + 80, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  return () => page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("Learn to Code walks through its four stages", async ({ page }, testInfo) => {
  await page.goto("/learn-to-code", { waitUntil: "networkidle" });
  const learn = win(page, "Learn to code");
  await expect(learn.getByRole("tab", { name: /Start/ })).toHaveAttribute("aria-selected", "true");
  await expect(learn.getByRole("link", { name: /CS50x/ })).toBeVisible();
  await learn.getByRole("tab", { name: /Go deeper/ }).click();
  await expect(learn.getByRole("link", { name: /Boot\.dev/ })).toBeVisible();
  await learn.getByRole("tab", { name: /Go deeper/ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(learn.getByRole("tab", { name: /Get hired/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(learn.getByRole("link", { name: /GitHub Student Developer Pack/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("learn.png") });
  // Get hired points at the hackathons near campus.
  await learn.getByRole("link", { name: "See hackathons near campus" }).click();
  await expect(page).toHaveURL(/\/hackathons$/);
  await expect(win(page, "Hackathons")).toBeVisible();
});

test("Hackathons lists what's coming up and how a hackathon works", async ({ page }, testInfo) => {
  await page.goto("/hackathons", { waitUntil: "networkidle" });
  const hack = win(page, "Hackathons");
  await expect(hack.getByRole("heading", { name: "SpartaHack 12" })).toBeVisible();
  await expect(hack.getByRole("link", { name: /Apply at spartahack\.com/ })).toHaveAttribute("href", "https://www.spartahack.com/");
  await page.screenshot({ path: testInfo.outputPath("hackathons.png") });
  // One tab per hackathon, then past results and regulars without dates.
  await hack.getByRole("tab", { name: /RocketHacks/ }).click();
  await expect(hack.getByRole("heading", { name: "RocketHacks 2027" })).toBeVisible();
  await expect(hack.getByRole("heading", { name: "SpartaHack 12" })).toBeHidden();
  await hack.getByRole("tab", { name: /How it works/ }).click();
  await expect(hack.getByRole("heading", { name: "how a hackathon works" })).toBeVisible();
  await expect(hack.getByText(/1st place in the Mind & Machine track/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Desktop" }).getByText("BuilderWars")).toHaveCount(0);
});

test("Search opens apps with the keyboard and finds places to learn", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search apps and places to learn" });
  await expect(search).toBeFocused();
  await search.fill("leet");
  await expect(page.getByRole("option").first()).toContainText("LeetCode");
  await search.fill("hack");
  await page.screenshot({ path: testInfo.outputPath("search.png") });
  await page.keyboard.press("Enter");
  await expect(search).toBeHidden();
  await expect(page).toHaveURL(/\/hackathons$/);
  // Escape in search closes search, not the window behind it.
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await expect(win(page, "Hackathons")).toBeVisible();
});

test("Windows dock to a side or the top, tear back off, and resize", async ({ page }, testInfo) => {
  await page.goto("/officers", { waitUntil: "networkidle" });
  const officers = win(page, "Officers");

  let drop = await dragBar(page, "Officers", 1439, 400);
  await expect(page.locator(".snap-hint")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("snap-hint.png") });
  await drop();
  await expect(officers).toHaveAttribute("data-snap", "right");
  let box = (await officers.boundingBox())!;
  // Docked windows keep a 10px gap from the edges and from each other.
  expect(box.x).toBeCloseTo(725, 0);
  expect(box.width).toBeCloseTo(705, 0);
  expect(box.y).toBeCloseTo(10, 0);

  // Dragging a docked window tears it off at its own width.
  drop = await dragBar(page, "Officers", 700, 300);
  await drop();
  await expect(officers).not.toHaveAttribute("data-snap");
  box = (await officers.boundingBox())!;
  expect(box.width).toBeLessThan(600);

  // The top edge maximizes; Restore puts it back.
  drop = await dragBar(page, "Officers", 700, 1);
  await drop();
  await expect(page.getByRole("button", { name: "Restore Officers" })).toBeVisible();
  await page.getByRole("button", { name: "Restore Officers" }).click();
  await expect(page.getByRole("button", { name: "Maximize Officers" })).toBeVisible();

  // The bottom-right corner resizes.
  box = (await officers.boundingBox())!;
  await page.mouse.move(box.x + box.width - 6, box.y + box.height - 6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 150, box.y + box.height - 60, { steps: 8 });
  await page.mouse.up();
  const after = (await officers.boundingBox())!;
  expect(after.width).toBeCloseTo(box.width + 156, -1);
  expect(after.height).toBeCloseTo(box.height - 54, -1);
});

test("A window behind another can be dragged straight away", async ({ page }) => {
  // On a fresh load welcome.txt opens on top of Meetings; grabbing Meetings has to raise it and move it in one go.
  await page.goto("/", { waitUntil: "networkidle" });
  const meetings = win(page, "Meetings");
  await expect(meetings).toBeVisible();
  const drop = await dragBar(page, "Meetings", 1439, 400);
  await drop();
  await expect(meetings).toHaveAttribute("data-snap", "right");
});

test("Bulbs answer the pointer, the wallpaper shifts, and it all goes still", async ({ page }) => {
  // Motion on for this one: reduced motion drops the swinging and the parallax.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800); // the startup zoom
  const read = () =>
    page.evaluate(() => {
      const bulbs = [...document.querySelectorAll<HTMLElement>(".desk-wallpaper .lights-bulb")].filter((b) => b.offsetParent);
      return {
        lit: bulbs.filter((b) => +b.style.getPropertyValue("--near") > 0.05).length,
        swinging: bulbs.filter((b) => Math.abs(parseFloat(b.style.getPropertyValue("--swing"))) > 1).length,
        px: parseFloat(document.querySelector<HTMLElement>(".desk-wallpaper")!.style.getPropertyValue("--px")),
      };
    });
  await page.mouse.move(250, 40);
  await page.mouse.move(650, 40, { steps: 5 });
  await page.waitForTimeout(90);
  const brushed = await read();
  if (brushed.lit === 0) test.skip(true, "No holiday lights this season");
  expect(brushed.swinging).toBeGreaterThan(0);
  await page.mouse.move(1430, 450, { steps: 4 });
  await expect.poll(async () => (await read()).px).toBeLessThan(-6);
  await expect.poll(async () => (await read()).swinging, { timeout: 8000 }).toBe(0);
  // Once everything settles, nothing runs every frame.
  const framesInHalfASecond = () =>
    page.evaluate(
      () =>
        new Promise<number>((done) => {
          let n = 0;
          const raf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = (f) => (n++, raf(f));
          setTimeout(() => {
            window.requestAnimationFrame = raf;
            done(n);
          }, 500);
        }),
    );
  await expect.poll(framesInHalfASecond, { timeout: 10_000 }).toBe(0);
});

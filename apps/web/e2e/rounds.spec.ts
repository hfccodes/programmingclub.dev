import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The rounds as players and the room see them: the real TV, a player's join page, and the officers' test page, on
// host-layout-convex.jsx's local store (see fixtures/rounds.jsx). Fix it for real and puzzles run real Python, so
// Pyodide's CDN is the one network host allowed. Screenshots go to this run's output directory, never the repo.

const stub = "/e2e/fixtures/host-layout-convex.jsx";
const fixture = "/e2e/fixtures/rounds.jsx";
const PYODIDE = "cdn.jsdelivr.net";
// A December Wednesday, so every page wears winter, and the clock is the same on each run.
const NIGHT = new Date("2026-12-02T17:20:00-05:00");

const SIZES = {
  tv: { width: 1920, height: 1080 },
  tvSmall: { width: 1366, height: 768 },
  laptop: { width: 1366, height: 768 },
  // A wider, shorter laptop: 1536 across, with the browser's bars taking the height.
  laptopShort: { width: 1536, height: 690 },
  phone: { width: 390, height: 844 },
} as const;
type Size = keyof typeof SIZES;

type Screen = Record<string, unknown> & { mode: string };
// The store's controls (host-layout.spec.ts declares the full type on window).
type Store = {
  external: (name: string, args: Record<string, unknown>) => void;
  fail: (name: string, message?: string) => void;
  snapshot: () => { calls: { name: string; args: Record<string, unknown> }[] };
};
type WithStore = { __hostLayout: Store };

test.describe.configure({ timeout: 120_000 });

async function mount(page: Page, which: "tv" | "join" | "test" | "wiki", size: Size) {
  const base = new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:3000");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Pyodide's CDN fetches are fine; anything else red is a bug.
    if (m.type() === "error" && !m.text().includes(PYODIDE)) errors.push(`console: ${m.text()}`);
  });
  await page.setViewportSize(SIZES[size]);
  await page.clock.setFixedTime(NIGHT);
  await page.routeWebSocket(/.*/, (ws) => {
    if (new URL(ws.url()).host !== base.host) ws.close();
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === PYODIDE) return route.continue();
    if (!["GET", "HEAD"].includes(route.request().method()) || url.origin !== base.origin) return route.abort();
    if (url.pathname === "/__rounds")
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
          <script type="module">
            import RefreshRuntime from "/@react-refresh";
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {};
            window.$RefreshSig$ = () => (type) => type;
            window.__vite_plugin_react_preamble_installed__ = true;
            await import("/src/styles.css");
            const fixture = await import("${fixture}");
            await fixture.mount(${JSON.stringify(which)}, "solo");
          </script></body></html>`,
      });
    if (url.pathname.startsWith("/src/") || url.pathname === fixture || url.pathname === stub) {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(/from "[^"]*(?:convex_react\.js|@clerk\/tanstack-react-start\/dist\/index\.js)[^"]*"/g, `from "${stub}"`);
      body = body.replace(/from "\/e2e\/fixtures\/host-layout-convex\.jsx[^"]*"/g, `from "${stub}"`);
      body = body.replace(/((?:from|import)\s*\(?\s*"[^"]+?)[?&]t=\d+(&[^"]*)?"/g, (_, path: string, rest = "") =>
        rest ? `${path}?${rest.slice(1)}"` : `${path}"`,
      );
      return route.fulfill({ response, body });
    }
    return route.continue();
  });
  await page.goto("/__rounds");
  await expect(page.locator("#rounds-mount :is(h1, h2, h3, p, button):visible").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

/** Changes the night from the host's console: what's on the TV, then its clock. */
async function stage(page: Page, screen: Screen, seconds?: number) {
  await page.evaluate(
    ([next, secs]) => {
      const s = (window as unknown as WithStore).__hostLayout;
      s.external("sessions:setScreen", { screen: next });
      if (secs) s.external("sessions:timer", { action: "set", seconds: secs, autostart: true });
    },
    [screen, seconds] as const,
  );
}

async function shot(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

/** Whether the page scrolls sideways or down, and any text cut off by its box or pushed past the TV's stage. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const doc = document.scrollingElement ?? document.documentElement;
    // The TV's stage: everything above the ticker, which hides what doesn't fit.
    const room = document.querySelector("#rounds-mount footer")?.previousElementSibling?.getBoundingClientRect();
    const text = [...document.querySelectorAll<HTMLElement>("#rounds-mount :is(pre, p, h2, h3, li, [role=timer])")].filter(
      (el) => el.getClientRects().length > 0 && !el.closest("[aria-hidden=true]"),
    );
    const clipped = text
      .filter(
        (el) =>
          (getComputedStyle(el).overflow === "hidden" && el.scrollHeight > el.clientHeight + 2) ||
          (room && el.getBoundingClientRect().bottom > room.bottom + 1),
      )
      .map((el) => el.textContent.slice(0, 40));
    return { overflowX: doc.scrollWidth > innerWidth, tall: doc.scrollHeight > innerHeight + 1, clipped };
  });

// ---- The TV --------------------------------------------------------------------------------------------------------

const TV: [string, Screen, number?][] = [
  ["output-1", { mode: "card", game: "output", index: 1 }, 30],
  ["output-1-reveal", { mode: "card", game: "output", index: 1, revealed: true }],
  ["output-7-reveal", { mode: "card", game: "output", index: 7, revealed: true }],
  ["bug-0", { mode: "card", game: "bug", index: 0 }, 60],
  ["bug-27", { mode: "card", game: "bug", index: 27 }, 60],
  ["bug-27-reveal", { mode: "card", game: "bug", index: 27, revealed: true }],
  ["lang-0", { mode: "card", game: "lang", index: 0 }, 30],
  ["fix-0", { mode: "card", game: "fix", index: 0 }, 240],
  ["fix-1-hint", { mode: "card", game: "fix", index: 1, hint: true }, 240],
  ["fix-1-reveal", { mode: "card", game: "fix", index: 1, revealed: true }],
  ["fix-8-hint", { mode: "card", game: "fix", index: 8, hint: true }, 240],
  ["puzzle-0", { mode: "card", game: "puzzle", index: 0, hint: true }, 600],
  ["puzzle-0-reveal", { mode: "card", game: "puzzle", index: 0, revealed: true }],
  ["wiki-ready", { mode: "wiki", wikiFrom: "Gingerbread", wikiTo: "Linux", wikiReady: true }],
  ["wiki-race", { mode: "wiki", wikiFrom: "Gingerbread", wikiTo: "Linux" }, 300],
  ["scoreboard", { mode: "scoreboard" }],
];

for (const size of ["tv", "tvSmall"] as const)
  test(`TV screens fit at ${size}`, async ({ page }) => {
    const errors = await mount(page, "tv", size);
    for (const [name, screen, seconds] of TV) {
      await stage(page, screen, seconds);
      await page.waitForTimeout(150);
      await shot(page, `tv-${size}-${name}`);
      const m = await layout(page);
      expect(m.overflowX, name).toBe(false);
      expect(m.tall, name).toBe(false);
      expect(m.clipped, name).toEqual([]);
      // A card being played shows its clock up top, beside its status; only one clock on screen.
      if (seconds) await expect(page.getByRole("timer", { name: "Time left" }), name).toBeVisible();
    }
    // One player tonight: the count reads as one.
    await stage(page, { mode: "card", game: "output", index: 2 }, 30);
    await expect(page.getByText("of 1 player locked in")).toBeVisible();

    // A full solo night: a row per player beside the cards still fits.
    await page.evaluate(() => {
      for (const n of [
        "Ada",
        "Grace",
        "Linus",
        "Alan",
        "Barbara",
        "Dennis",
        "Katherine",
        "Ken",
        "Radia",
        "Edsger",
        "Frances",
        "Guido",
        "Hedy",
      ])
        (window as unknown as { __hostLayout: { join: (name: string) => void } }).__hostLayout.join(n);
    });
    for (const [name, screen, seconds] of [
      ["crowd-bug-27-reveal", { mode: "card", game: "bug", index: 28, revealed: true }],
      ["crowd-output-reveal", { mode: "card", game: "output", index: 3, revealed: true }],
      ["crowd-puzzle", { mode: "card", game: "puzzle", index: 1 }, 600],
      ["crowd-fix", { mode: "card", game: "fix", index: 2 }, 240],
    ] as [string, Screen, number?][]) {
      await stage(page, screen, seconds);
      await page.waitForTimeout(150);
      await shot(page, `tv-${size}-${name}`);
      expect((await layout(page)).clipped, name).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

// ---- A player's laptop: Fix it for real with real Python -------------------------------------------------------------

/**
 * What a player debugging on a laptop must keep in sight at once: the editor (and the line Python stopped on, if it's
 * marked), Run and Check, and the line of the result they're reading. Each must be on screen and clear of the sticky
 * bar, which must not sit over the editor. Returns the scroll position too, so a step can show the page never jumped.
 */
async function workspace(page: Page, reading?: ReturnType<Page["locator"]>) {
  // The join page's slim bar, or the site's header on the officers' test page.
  const bar = await page.locator("#rounds-mount :is(.theme-pine.sticky, header.sticky)").first().boundingBox();
  const top = bar ? bar.y + bar.height : 0;
  const { height } = page.viewportSize()!;
  const editor = page.getByRole("textbox", { name: "Your program" });
  const pane = page.locator("section", { has: editor }).locator(".code", { has: editor });
  const boxes = {
    task: page.locator("#fix-task"),
    editor: pane,
    run: page.getByRole("button", { name: /^Run the example/ }),
    check: page.getByRole("button", { name: "Check my fix" }),
    ...(reading ? { reading } : {}),
  };
  const off: string[] = [];
  for (const [name, loc] of Object.entries(boxes)) {
    const r = await loc.boundingBox();
    // Inside the results' own scrolling box, it must show within that box, not just somewhere on the screen.
    const clip = await loc.evaluate((el) => {
      const b = el.closest("[role=region]")?.getBoundingClientRect();
      return b ? { top: b.top, bottom: b.bottom } : null;
    });
    const [from, to] = [Math.max(top, clip?.top ?? 0), Math.min(height, clip?.bottom ?? height)];
    // The editor may be taller than the room left, but its top rows (where reading starts) must show.
    const bottom = name === "editor" ? r && r.y + Math.min(r.height, 120) : r && r.y + r.height;
    if (!r || r.y < from - 1 || bottom! > to + 1)
      off.push(`${name} ${r ? `${Math.round(r.y)}..${Math.round(r.y + r.height)}` : "missing"}`);
  }
  // The line Python stopped on, marked in the editor's gutter, must show inside the editor's own box.
  const mark = pane.locator(".bg-signal");
  if (await mark.count()) {
    const [m, e] = await Promise.all([mark.boundingBox(), pane.boundingBox()]);
    if (!m || !e || m.y < Math.max(top, e.y) - 1 || m.y + m.height > Math.min(height, e.y + e.height) + 1) off.push("error line");
  }
  // Both tonight's programs are short: the last line must remain readable too, including after a successful Check.
  const [last, bounds] = await Promise.all([pane.locator("pre span").last().boundingBox(), pane.boundingBox()]);
  if (!last || !bounds || last.y + last.height > bounds.y + bounds.height + 1) off.push("last code line");
  return { off, scrollY: await page.evaluate(() => scrollY) };
}

for (const size of ["laptop", "laptopShort"] as const)
  test(`Fix it for real at ${size}: run, read the error, fix it, and check without losing the code`, async ({ page }) => {
    const errors = await mount(page, "join", size);
    await stage(page, { mode: "card", game: "fix", index: 1 }, 240);
    const editor = page.getByRole("textbox", { name: "Your program" });
    await expect(page.getByRole("heading", { name: "stocking stuffers" })).toBeVisible();
    const run = page.getByRole("button", { name: "Run the example" });
    await expect(run).toBeEnabled({ timeout: 60_000 });
    expect((await workspace(page)).off).toEqual([]);
    await shot(page, `join-${size}-fix-1-start`);

    // The player's own typo: a stray "f" on a line by itself, as in the screenshot from the night.
    const code = await editor.inputValue();
    await editor.fill(code.replace("for stocking in range(stockings):\n", "for stocking in range(stockings):\n    f\n"));
    const before = await page.evaluate(() => scrollY);
    await run.click();
    const result = page.locator("section", { has: editor }).locator(".card").filter({ hasText: "Run result" });
    const crash = result.getByText("NameError: name 'f' is not defined", { exact: true });
    await expect(crash).toBeVisible({ timeout: 30_000 });
    await expect(result.getByText("Python stopped on line 3:")).toBeVisible();
    // A crash before any output says so, rather than an empty "(nothing)" beside what it should print.
    await expect(result.getByText("Example 1 crashed before printing anything.")).toBeVisible();
    await expect(result.getByText("(nothing)")).toHaveCount(0);
    await page.waitForTimeout(400);
    // Everything the player needs is still in view, the error line marked, and the page didn't move under them.
    let now = await workspace(page, crash);
    expect(now.off).toEqual([]);
    expect(now.scrollY).toBe(before);
    await expect(result.getByRole("status")).toBeInViewport();
    await shot(page, `join-${size}-fix-1-typo`);

    // The whole traceback, a click away, in a box of its own: the code stays put above it.
    await expect(result.locator("details pre")).toBeHidden();
    await result.getByText("Full traceback").click();
    const trace = result.locator("details pre");
    await expect(trace).toContainText("Traceback (most recent call last)");
    await page.waitForTimeout(400);
    now = await workspace(page, trace);
    expect(now.off).toEqual([]);
    expect(now.scrollY).toBe(before);
    // The details box ends above the screen's bottom and below the editor: nothing covers the code.
    const [ed, tr] = await Promise.all([editor.boundingBox(), trace.boundingBox()]);
    expect(tr!.y).toBeGreaterThan(ed!.y + ed!.height);
    await shot(page, `join-${size}-fix-1-traceback`);

    // Right there: delete the typo and run again, without scrolling back up to find the editor.
    await editor.fill(code);
    await expect(result.getByText("You’ve changed the code since")).toBeVisible();
    await run.click();
    await expect(result.getByText("0 of 1 example right.")).toBeVisible({ timeout: 30_000 });
    await expect(result.getByText("Your program printed", { exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    now = await workspace(page, result.getByRole("status"));
    expect(now.off).toEqual([]);
    expect(now.scrollY).toBe(before);
    await shot(page, `join-${size}-fix-1-wrong`);

    // The real fix: start the total once, before the loop. Run it, then Check.
    await editor.fill(code.replace("\n    total = 0", "").replace("stockings = int(input())", "stockings = int(input())\ntotal = 0"));
    await run.click();
    await expect(result.getByText("The example works. Now Check my fix")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Check my fix" }).click();
    await expect(page.getByText("Every test passes")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Your fix counts. Points go up at the reveal.")).toBeVisible();
    expect((await page.evaluate(() => (window as unknown as WithStore).__hostLayout.snapshot())).calls.map((c) => c.name)).toContain(
      "fixes:reportByToken",
    );
    await page.waitForTimeout(400);
    expect((await workspace(page, page.getByText("Every test passes"))).off).toEqual([]);
    await shot(page, `join-${size}-fix-1-fixed`);

    await stage(page, { mode: "card", game: "fix", index: 1, revealed: true });
    await expect(page.getByText("The fix.", { exact: true })).toBeVisible();
    // Revealed before its points come back, a recorded fix still reads as fixed, never "not fixed".
    await expect(page.getByText(/^✓ Fixed/)).toBeVisible();
    await shot(page, `join-${size}-fix-1-reveal`);
    // The reveal is longer than the screen: the page scrolls to it, and the workspace stays beside it, clear of the bar.
    await page.getByText("The fix.", { exact: true }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    const after = await workspace(page);
    expect(after.off.filter((o) => !o.startsWith("task"))).toEqual([]);
    await shot(page, `join-${size}-fix-1-reveal-scrolled`);
    expect((await layout(page)).overflowX).toBe(false);
    expect(errors).toEqual([]);
  });

test("Fix it for real cookie tray: the TypeError, then every failing test, with the code in view", async ({ page }) => {
  const errors = await mount(page, "join", "laptop");
  await stage(page, { mode: "card", game: "fix", index: 0 }, 240);
  const run = page.getByRole("button", { name: "Run the example" });
  await expect(run).toBeEnabled({ timeout: 60_000 });
  await shot(page, "join-laptop-fix-0-start");
  const before = await page.evaluate(() => scrollY);
  await run.click();
  const crash = page.getByText(/^TypeError: can only concatenate str/);
  await expect(crash).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Python stopped on line 4:")).toBeVisible();
  // It printed its welcome before crashing: that shows under the error.
  await expect(page.getByText("Before it crashed, it printed")).toBeVisible();
  await page.waitForTimeout(400);
  let now = await workspace(page, crash);
  expect(now.off).toEqual([]);
  expect(now.scrollY).toBe(before);
  await shot(page, "join-laptop-fix-0-typeerror");

  await page.getByText("Full traceback").click();
  await page.waitForTimeout(400);
  now = await workspace(page, page.locator("details pre"));
  expect(now.off).toEqual([]);
  expect(now.scrollY).toBe(before);
  await shot(page, "join-laptop-fix-0-traceback");

  await page.getByRole("button", { name: "Check my fix" }).click();
  const summary = page.getByText("0 of 4 tests pass. Your program crashed on some.");
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("crashed with TypeError").first()).toBeVisible();
  await page.waitForTimeout(400);
  now = await workspace(page, summary);
  expect(now.off).toEqual([]);
  expect(now.scrollY).toBe(before);
  // The details run longer than their box: it scrolls by itself (keyboard too), and the hidden tests are down there.
  const details = page.getByRole("region", { name: "Check details" });
  const hidden = details.getByText("Hidden tests");
  await details.focus();
  await page.keyboard.press("End");
  await expect(hidden).toBeInViewport();
  now = await workspace(page, hidden);
  expect(now.off).toEqual([]);
  expect(now.scrollY).toBe(before);
  await shot(page, "join-laptop-fix-0-check-fail");
  // Nothing was sent: only a passing check reports a fix.
  expect((await page.evaluate(() => (window as unknown as WithStore).__hostLayout.snapshot())).calls.map((c) => c.name)).not.toContain(
    "fixes:reportByToken",
  );
  expect(errors).toEqual([]);
});

test("Fix it for real on a phone", async ({ page }) => {
  const errors = await mount(page, "join", "phone");
  await stage(page, { mode: "card", game: "fix", index: 1 }, 240);
  await page.waitForTimeout(300);
  await shot(page, "join-phone-fix-1-status");
  await page.getByRole("button", { name: "On a tablet? Open the full fix here" }).click();
  const run = page.getByRole("button", { name: "Run the example" });
  await expect(run).toBeEnabled({ timeout: 60_000 });
  // The typo again: on a phone it all stacks, so the result's first line comes up into view, clear of the bar, with the
  // buttons (and the editor right above them) a short scroll back.
  const editor = page.getByRole("textbox", { name: "Your program" });
  const code = await editor.inputValue();
  await editor.fill(code.replace("for stocking in range(stockings):\n", "for stocking in range(stockings):\n    f\n"));
  await run.click();
  const summary = page.getByText("0 of 1 example right.");
  await expect(summary).toBeInViewport({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const [bar, line] = await Promise.all([page.locator("#rounds-mount .theme-pine.sticky").boundingBox(), summary.boundingBox()]);
  expect(line!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  await expect(page.getByText("NameError: name 'f' is not defined", { exact: true })).toBeInViewport();
  await shot(page, "join-phone-fix-1-run");
  await page.getByText("Full traceback").click();
  await expect(page.locator("details pre")).toBeVisible();
  await shot(page, "join-phone-fix-1-traceback");
  await run.scrollIntoViewIfNeeded();
  await expect(run).toBeInViewport();
  expect((await layout(page)).overflowX).toBe(false);
  expect(errors).toEqual([]);
});

test("Output? on a phone", async ({ page }) => {
  const errors = await mount(page, "join", "phone");
  await stage(page, { mode: "card", game: "output", index: 1 }, 30);
  await page.waitForTimeout(300);
  await shot(page, "join-phone-output-1");
  expect((await layout(page)).overflowX).toBe(false);
  expect(errors).toEqual([]);
});

test("Fix it for real on the officers' test page: the workspace sticks under the site's header", async ({ page }) => {
  const errors = await mount(page, "test", "laptop");
  await page.getByRole("radio", { name: "Fix it for real" }).click();
  const run = page.getByRole("button", { name: "Run the example" });
  await expect(run).toBeEnabled({ timeout: 60_000 });
  // The page's own intro is above it: the officer scrolls down to the card, then works without scrolling again.
  await page.locator("section[aria-labelledby=fix-task]").evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 110));
  await page.waitForTimeout(200);
  expect((await workspace(page)).off).toEqual([]);
  const before = await page.evaluate(() => scrollY);
  await run.click();
  const crash = page.getByText(/^TypeError: can only concatenate str/);
  await expect(crash).toBeVisible({ timeout: 30_000 });
  await page.getByText("Full traceback").click();
  await page.waitForTimeout(400);
  const now = await workspace(page, page.locator("details pre"));
  expect(now.off).toEqual([]);
  expect(now.scrollY).toBe(before);
  await shot(page, "test-laptop-fix-0-traceback");
  expect((await layout(page)).overflowX).toBe(false);
  expect(errors).toEqual([]);
});

// ---- Puzzles, on the officers' test page (local state, real Python) -----------------------------------------------

test("puzzle workspace on a laptop", async ({ page }) => {
  const errors = await mount(page, "test", "laptop");
  await page.getByRole("radio", { name: "Puzzle" }).click();
  await expect(page.getByRole("button", { name: "Run on the example" })).toBeEnabled({ timeout: 60_000 });
  await shot(page, "test-laptop-puzzle-start");
  const editor = page.getByRole("textbox", { name: "Your program" });
  await editor.fill('lines = open("input.txt").read().splitlines()\nprint(lines[99999])\n');
  await page.getByRole("button", { name: "Run on the example" }).click();
  await expect(page.getByText(/IndexError/).first()).toBeInViewport({ timeout: 30_000 });
  await expect(page.getByText("On the example, your program crashed before printing anything")).toBeVisible();
  await expect(editor).toBeInViewport();
  await shot(page, "test-laptop-puzzle-error");
  await editor.fill('print("Changed since the last run")');
  await expect(page.getByText("You’ve changed the code since")).toBeVisible();
  expect((await layout(page)).overflowX).toBe(false);
  expect(errors).toEqual([]);
});

// ---- Wiki Race: the club tab is home base, and Wikipedia is a tab the player opens ----------------------------------

const RACE = { mode: "wiki", wikiFrom: "Gingerbread", wikiTo: "Linux" } as const;
const NEXT = { mode: "wiki", wikiFrom: "Pizza", wikiTo: "Moon", wikiClicks: true } as const;
const WIKIPEDIA = "https://en.wikipedia.org/wiki/";

/** A night change from the host's console, by mutation name. */
const host = (page: Page, name: string, args: Record<string, unknown>) =>
  page.evaluate(([n, a]) => (window as unknown as WithStore).__hostLayout.external(n, a), [name, args] as const);
const calls = async (page: Page, name: string) =>
  (await page.evaluate(() => (window as unknown as WithStore).__hostLayout.snapshot())).calls.filter((c) => c.name === name);

/** Wikipedia, as an inert page, so no test reaches the real site. Any tab or page the browser opens there lands here. */
async function fakeWikipedia(page: Page) {
  const seen: string[] = [];
  const handler = (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
    seen.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Wikipedia (stand-in)</title><h1>Stand-in article</h1>" });
  };
  await page.context().route(`${WIKIPEDIA}**`, handler);
  await page.route(`${WIKIPEDIA}**`, handler);
  return seen;
}

/** The host's "Show on TV" (get ready, clock set but stopped), then Go (the race goes up and its clock starts). */
async function ready(page: Page, race: Screen, seconds: number) {
  await host(page, "sessions:setScreen", { screen: { ...race, wikiReady: true } });
  await host(page, "sessions:timer", { action: "set", seconds, relay: false });
}
async function go(page: Page, race: Screen, seconds: number) {
  await host(page, "sessions:setScreen", { screen: race });
  await host(page, "sessions:timer", { action: "set", seconds, relay: false, autostart: true });
}

/** A screenshot once the winter sweep between screens has run, so it shows the screen a player actually reads. */
async function settledShot(page: Page, name: string) {
  await expect(page.locator("#rounds-mount .shift")).toHaveCount(0, { timeout: 10_000 });
  await shot(page, name);
}

/** What get ready must never show: the race itself, a link to Wikipedia, or a button to open another page. */
async function expectNothingToOpen(page: Page, race: { wikiFrom: string; wikiTo: string }) {
  const root = page.locator("#rounds-mount");
  await expect(root).not.toContainText(race.wikiFrom);
  await expect(root).not.toContainText(race.wikiTo);
  await expect(page.locator(`#rounds-mount a[href*="wikipedia.org"], #rounds-mount a[href*="/wiki"]`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /open the race/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /open the race/i })).toHaveCount(0);
}

for (const size of ["phone", "laptop"] as const)
  test(`Wiki Race in the club tab at ${size}: get ready, Go, Wikipedia in its own tab, finish, undo, the referee, next race`, async ({
    page,
  }) => {
    const errors = await mount(page, "join", size);
    const wikipedia = await fakeWikipedia(page);
    const tabs: string[] = [];
    page.context().on("page", (p) => tabs.push(p.url()));
    // Week 4's second round is its Wiki Race.
    await host(page, "sessions:setRound", { round: 1 });

    // Get ready: a calm card with the race's number, and nothing to open or tap.
    await ready(page, RACE, 300);
    await expect(page.getByText("Get ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Race 1 of 2", { exact: true })).toBeVisible();
    await expect(page.getByText("The start and target show up here when the race starts.", { exact: false })).toBeVisible();
    await expectNothingToOpen(page, RACE);
    await expect(page.locator("#rounds-mount").getByText("5:00", { exact: true }).filter({ visible: true })).toHaveCount(0);
    await settledShot(page, `join-${size}-wiki-ready`);
    expect((await layout(page)).overflowX).toBe(false);

    // Go: the race, its clock, and a link the player opens themselves.
    await go(page, RACE, 300);
    await expect(page.getByText("Gingerbread", { exact: true })).toBeVisible();
    await expect(page.getByText("Linux", { exact: true })).toBeVisible();
    // The clock: the slim bar's timer on a phone, the big clock beside the player card on a laptop.
    await expect(page.locator("#rounds-mount").getByText("5:00", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const open = page.getByRole("link", { name: "Open Gingerbread on Wikipedia ↗" });
    await expect(open).toHaveAttribute("href", `${WIKIPEDIA}Gingerbread`);
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.getByText("Opens in a new tab. Come back to this tab to finish.")).toBeVisible();
    // Finishing never waits on the link: someone may be racing on another computer.
    const madeIt = page.getByRole("button", { name: "I made it!" });
    await expect(madeIt).toBeEnabled();
    await expect(madeIt).toBeInViewport();
    await settledShot(page, `join-${size}-wiki-go`);
    expect((await layout(page)).overflowX).toBe(false);
    // The page opened no tab and reached no Wikipedia on its own.
    expect(tabs).toEqual([]);
    expect(wikipedia).toEqual([]);

    // The player's click opens Wikipedia in a new tab; the club tab stays put, finish and all.
    const before = page.url();
    const [tab] = await Promise.all([page.context().waitForEvent("page"), open.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe(`${WIKIPEDIA}Gingerbread`);
    await expect(tab.getByRole("heading", { name: "Stand-in article" })).toBeVisible();
    // rel=noopener: Wikipedia's tab can't reach back into this one.
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    await tab.close();
    expect(page.url()).toBe(before);
    await page.bringToFront();
    await expect(madeIt).toBeEnabled();

    // Finish, with its check, then undo it.
    await madeIt.click();
    await expect(page.getByText("On the Linux article?")).toBeVisible();
    await page.getByRole("button", { name: "Not yet" }).click();
    await expect(madeIt).toBeVisible();
    await madeIt.click();
    await page.getByRole("button", { name: "Yes, I made it" }).click();
    await expect(page.getByText("You made it!")).toBeVisible();
    await expect(page.getByText("Raise your hand and keep the target article open")).toBeVisible();
    await expect(open).toHaveCount(0);
    await page.getByRole("button", { name: "Undo: I’m not there yet" }).click();
    await expect(madeIt).toBeVisible();
    await expect(open).toBeVisible();
    expect((await calls(page, "wiki:undo")).length).toBe(1);

    // The referee says not yet: back to racing, link and all.
    await madeIt.click();
    await page.getByRole("button", { name: "Yes, I made it" }).click();
    await expect(page.getByText("You made it!")).toBeVisible();
    await host(page, "wiki:check", { teamId: "team-1", card: "wiki:Gingerbread>Linux", ok: false });
    await expect(page.getByText("The referee says not yet. Keep going, then tap again.")).toBeVisible();
    await expect(open).toBeVisible();
    await expect(madeIt).toBeEnabled();

    // Then it counts: no undo once the referee has checked it.
    await madeIt.click();
    await page.getByRole("button", { name: "Yes, I made it" }).click();
    await host(page, "wiki:check", { teamId: "team-1", card: "wiki:Gingerbread>Linux", ok: true });
    await expect(page.getByText("The referee checked it. ✓")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo: I’m not there yet" })).toHaveCount(0);
    await settledShot(page, `join-${size}-wiki-checked`);

    // Race over and scored: the result, and no link.
    // As the host's "End race and score" does it: the race revealed, then its clock paused.
    await host(page, "sessions:setScreen", { screen: { ...RACE, revealed: true } });
    await host(page, "sessions:timer", { action: "pause" });
    await expect(page.getByText("1st place! +", { exact: false })).toBeVisible();
    await expect(open).toHaveCount(0);
    await settledShot(page, `join-${size}-wiki-result`);

    // The next race comes to the same tab as get ready by itself, with nothing of the last race left on it.
    await ready(page, NEXT, 360);
    await expect(page.getByText("Get ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Race 2 of 2 · Fewest Clicks", { exact: true })).toBeVisible();
    await expectNothingToOpen(page, NEXT);
    await expect(page.locator("#rounds-mount")).not.toContainText("Gingerbread");
    await settledShot(page, `join-${size}-wiki-next-ready`);

    // Fewest Clicks: a fresh race with a fresh count, and only 1 to 999 sends.
    await go(page, NEXT, 360);
    await expect(page.getByRole("link", { name: "Open Pizza on Wikipedia ↗" })).toHaveAttribute("href", `${WIKIPEDIA}Pizza`);
    await expect(page.getByText("You made it!")).toHaveCount(0);
    const count = page.getByRole("spinbutton", { name: "Clicks to get there" });
    await expect(count).toHaveValue("");
    await expect(madeIt).toBeDisabled();
    for (const bad of ["0", "1000", "2.5"]) {
      await count.fill(bad);
      await expect(madeIt, bad).toBeDisabled();
    }
    await count.fill("7");
    await expect(madeIt).toBeEnabled();
    await settledShot(page, `join-${size}-wiki-clicks`);

    // A finish that doesn't reach the server says so, and leaves the finish to try again.
    await page.evaluate(() => (window as unknown as WithStore).__hostLayout.fail("wiki:finish", "offline"));
    await madeIt.click();
    await page.getByRole("button", { name: "Yes, send it" }).click();
    await expect(page.getByRole("alert")).toHaveText("That didn’t go through. Check your connection and try again.");
    await expect(page.getByText("You made it!")).toHaveCount(0);
    await expect(madeIt).toBeEnabled();
    await madeIt.click();
    await expect(page.getByText("Send 7 clicks?")).toBeVisible();
    await page.getByRole("button", { name: "Yes, send it" }).click();
    await expect(page.getByText("7 clicks", { exact: false })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect((await calls(page, "wiki:finish")).at(-1)?.args).toMatchObject({ card: "wiki:Pizza>Moon", clicks: 7 });
    await page.getByRole("button", { name: "Undo: I’m not there yet" }).click();

    // Time's up: the race closes, and so does the link.
    await page.clock.setFixedTime(new Date(NIGHT.getTime() + 361_000));
    await expect(page.getByText("Time’s up. The race is closed.")).toBeVisible();
    await expect(page.getByRole("link", { name: /on Wikipedia/ })).toHaveCount(0);
    await expect(madeIt).toHaveCount(0);
    await settledShot(page, `join-${size}-wiki-time-up`);

    // Only the one tab the player opened, ever.
    expect(tabs.length).toBe(1);
    expect(errors).toEqual([]);
  });

for (const size of ["tv", "tvSmall"] as const)
  test(`Wiki Race on the TV at ${size}: /wiki on get ready only, then the race, its clock, and the rules`, async ({ page }) => {
    const errors = await mount(page, "tv", size);
    await host(page, "sessions:setRound", { round: 1 });
    await ready(page, RACE, 300);
    await expect(page.getByText("Get ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Wiki Race · Race 1 of 2", { exact: true })).toBeVisible();
    await expect(page.getByText("programmingclub.dev/wiki")).toBeVisible();
    const room = page.locator("#rounds-mount footer").locator("xpath=preceding-sibling::*[1]");
    await expect(room).not.toContainText("Gingerbread");
    await expect(room).not.toContainText("Linux");
    await page.waitForTimeout(150);
    await settledShot(page, `tv-${size}-wiki-get-ready`);
    let m = await layout(page);
    expect([m.overflowX, m.tall, m.clipped]).toEqual([false, false, []]);

    await go(page, RACE, 300);
    await expect(page.getByText("Gingerbread", { exact: true })).toBeVisible();
    await expect(page.getByText("Linux", { exact: true })).toBeVisible();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await expect(page.getByText("Race 1 of 2", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Links inside the article only.", { exact: false })).toBeVisible();
    await expect(page.locator("#rounds-mount")).not.toContainText("/wiki");
    await page.waitForTimeout(150);
    await settledShot(page, `tv-${size}-wiki-race`);
    m = await layout(page);
    expect([m.overflowX, m.tall, m.clipped]).toEqual([false, false, []]);

    // The finish order as phones tap in.
    await host(page, "wiki:finish", { card: "wiki:Gingerbread>Linux" });
    await expect(page.getByRole("listitem").filter({ hasText: "Juan" })).toBeVisible();
    await page.waitForTimeout(150);
    await settledShot(page, `tv-${size}-wiki-finished`);
    m = await layout(page);
    expect([m.overflowX, m.tall, m.clipped]).toEqual([false, false, []]);
    expect(errors).toEqual([]);
  });

test("Wiki Race on a computer at /wiki: it waits through get ready, goes to the start at Go, and says to reopen it", async ({ page }) => {
  const errors = await mount(page, "wiki", "laptop");
  const wikipedia = await fakeWikipedia(page);
  await host(page, "sessions:setRound", { round: 1 });
  await expect(page.getByText("Keep this page open. It opens the start article on Wikipedia when the next race starts.")).toBeVisible();
  await expect(page.getByText("Before the next race, open programmingclub.dev/wiki here again.", { exact: false })).toBeVisible();
  // Nothing tells a computer to press Back to get here again: Back from the start article isn't this page.
  await expect(page.locator("#rounds-mount")).not.toContainText(/\bBack\b/);

  await ready(page, RACE, 300);
  await expect(page.getByText("You’re ready.", { exact: false })).toBeVisible();
  await expect(page.locator("#rounds-mount")).not.toContainText("Gingerbread");
  await page.waitForTimeout(300);
  expect(wikipedia).toEqual([]);
  await settledShot(page, "wiki-laptop-ready");
  expect(errors).toEqual([]);

  // Go: the race goes up and this tab becomes the start article (the clock starting after is the host's business).
  await Promise.all([page.waitForURL(`${WIKIPEDIA}Gingerbread`), host(page, "sessions:setScreen", { screen: RACE })]);
  expect(wikipedia).toEqual([`${WIKIPEDIA}Gingerbread`]);
});

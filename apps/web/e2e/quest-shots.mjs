// Snow Quest: talk to every NPC through every line, then take the review screenshots. node e2e/quest-shots.mjs outDir
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [out, base = "http://localhost:3112"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errs.push(m.text()));
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
await page.goto(base + "/hello-world/quest");
await page.waitForTimeout(2500);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("hwc.quest.practice", JSON.stringify({ seed: 12345, claimed: ["z1-lights"], waits: {} }));
});
await page.reload();
await page.waitForTimeout(2500);
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
const ev = (f, a) => page.evaluate(f, a);
const jump = async (id) => {
  await ev((id) => {
    const s = window.__quest.scene();
    const all = window.__quest.rooms;
    const into = all.flatMap((r) => r.exits).find((e) => e.to === id);
    s.enter(
      all.find((r) => r.id === id),
      { x: into.arrive[0] * 32 + 16, y: into.arrive[1] * 32 + 16 },
      into.face,
    );
  }, id);
  await page.waitForTimeout(1300);
};
const put = (who, ox, oy) =>
  ev(
    ([who, ox, oy]) => {
      const s = window.__quest.scene();
      const L = s.things.find((t) => t.life?.who === who).life;
      const f = s.free(L.fx + ox, L.fy + oy);
      s.player.setPosition(f.x, f.y);
      s.vx = s.vy = 0;
      return Math.round(Math.hypot(L.fx - f.x, L.fy - f.y));
    },
    [who, ox, oy],
  );
const shot = async (name, who) => {
  await page.screenshot({ path: `${out}/80-${name}.png` });
  if (!who) return;
  const box = await ev(() => document.querySelector("canvas").getBoundingClientRect().toJSON());
  const c = await ev((who) => {
    const L = window.__quest.scene().things.find((t) => t.life?.who === who).life;
    return [L.fx, L.fy];
  }, who);
  const k = box.width / 1536;
  const x = Math.max(0, Math.min(1366 - 420, box.x + c[0] * k - 210));
  const y = Math.max(0, Math.min(768 - 300, box.y + c[1] * k - 220));
  await page.screenshot({ path: `${out}/80-${name}-zoom.png`, clip: { x, y, width: 420, height: 300 } });
};
const dialog = () => ev(() => !!document.querySelector("[data-testid=quest-dialog]"));
// (b) every NPC, every line.
const rooms = await ev(() => window.__quest.rooms.map((r) => [r.id, r.spots.filter((s) => s.kind === "npc").map((s) => s.who)]));
const talks = [];
for (const [id, whos] of rooms)
  for (const who of whos) {
    await jump(id);
    await put(who, 0, 64);
    await page.waitForTimeout(450);
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const opened = await dialog();
    let presses = 0;
    while ((await dialog()) && presses < 30) {
      await page.keyboard.press("e");
      await page.waitForTimeout(260);
      presses++;
    }
    await page.waitForTimeout(300);
    const closed = await ev(() => !document.querySelector("[data-testid=quest-dialog]") && !window.__quest.bridge.paused);
    talks.push(`${id}:${who} opened=${opened} presses=${presses} closed=${closed}`);
  }
console.log(talks.join("\n"));
// (d) screenshots.
await jump("square");
await page.waitForTimeout(1500);
await shot("square-ambient");
await ev(() => {
  const s = window.__quest.scene();
  s.player.setPosition(420, 600);
});
await page.waitForTimeout(900);
await shot("square-between-pip-and-volt");
console.log(
  "square barks on screen:",
  await ev(() =>
    window.__quest
      .scene()
      .things.filter((t) => t.life?.bubble?.visible)
      .map((t) => t.life.who + ":" + t.life.bubble.getData("key")),
  ),
);
await page.waitForTimeout(7000);
await put("electrician", 130, 300);
await page.waitForTimeout(1500);
await put("electrician", 130, 30);
await page.waitForTimeout(800);
await shot("bark-volt", "electrician");
await jump("market");
await put("baker", 0, 330);
await page.waitForTimeout(800);
await shot("bea-far", "baker");
await put("baker", 20, 140);
await page.waitForTimeout(750);
await shot("bark-bea", "baker");
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(1500);
await page.keyboard.up("ArrowUp");
console.log(
  "gap to Bea after walking into her:",
  await ev(() => {
    const s = window.__quest.scene();
    const L = s.things.find((t) => t.life).life;
    return Math.round(Math.hypot(L.fx - s.player.x, L.fy - s.player.y));
  }),
);
await shot("market-next-to-bea", "baker");
await put("baker", -8, 64);
await page.waitForTimeout(5000);
await shot("talk-prompt", "baker");
await jump("clearing");
await put("owl", -130, 40);
await page.waitForTimeout(800);
await shot("bark-hoot", "owl");
await jump("rink");
await put("boarder", -140, 20);
await page.waitForTimeout(800);
await shot("bark-jax", "boarder");
// Skating: a spot well inside the ice.
await ev(() => {
  const s = window.__quest.scene();
  let best;
  for (let y = 300; y < 700; y += 20)
    for (let x = 400; x < 900; x += 20)
      if (!best && s.onIce(x, y) && s.onIce(x + 300, y) && s.onIce(x, y + 100) && !s.blocked(x, y)) best = [x, y];
  s.player.setPosition(best[0], best[1]);
  s.vx = s.vy = 0;
});
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(1100);
await shot("skate-1-push");
const frames = new Set();
for (let i = 0; i < 12; i++) {
  frames.add(await ev(() => window.__quest.scene().player.frame.name));
  await page.waitForTimeout(90);
}
await page.keyboard.up("ArrowRight");
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(700);
await page.keyboard.up("ArrowDown");
await page.waitForTimeout(250);
await shot("skate-2-glide");
console.log(
  "skating frames seen while pushing:",
  [...frames].join(","),
  "angle",
  await ev(() => window.__quest.scene().player.angle.toFixed(1)),
);
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await browser.close();

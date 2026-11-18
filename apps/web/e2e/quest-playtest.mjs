// Snow Quest self-playtest: drives the game with key presses from a plan, saving screenshots and console logs.
// Usage: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node e2e/quest-playtest.mjs plan.json outDir [baseUrl]
// A plan is a list of steps: ["shot", name] ["key", key, ms] ["press", key] ["tp", tileX, tileY] ["type", text]
// ["wait", ms] ["eval", js] ["room", id] ["goto", path] ["clear"] (clears localStorage) ["save", jsonForPracticeSave]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [planPath, out, base = "http://localhost:3112"] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const [vw, vh] = (process.env.VIEW ?? "1366x768").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const log = [];
page.on("console", (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => log.push(`[pageerror] ${e.message}`));
await page.goto(base + "/hello-world/quest");
await page.waitForTimeout(1500);
let n = 0;
for (const step of plan) {
  const [op, a, b] = step;
  try {
    if (op === "shot") await page.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-${a}.png` });
    else if (op === "key") {
      await page.keyboard.down(a);
      await page.waitForTimeout(b ?? 300);
      await page.keyboard.up(a);
    } else if (op === "press") await page.keyboard.press(a);
    else if (op === "tp")
      await page.evaluate(
        ([x, y]) => {
          const s = window.__quest.scene();
          s.player.setPosition(x * 32 + 16, y * 32 + 16);
          s.vx = s.vy = 0;
        },
        [a, b],
      );
    else if (op === "frame") await page.waitForTimeout(120);
    else if (op === "tpx")
      // Teleport to room pixels (nudged to the nearest free spot).
      log.push(
        "[tpx] " +
          (await page.evaluate(
            ([x, y]) => {
              const s = window.__quest.scene();
              const f = s.free(x, y);
              s.player.setPosition(f.x, f.y);
              s.vx = s.vy = 0;
              return `${x},${y} -> ${f.x},${f.y}`;
            },
            [a, b],
          )),
      );
    else if (op === "crop") {
      // ["crop", name, [x, y, w, h]] in room pixels: an enlarged view of part of the room.
      const box = await page.evaluate(() => document.querySelector("canvas").getBoundingClientRect().toJSON());
      const k = box.width / 1536;
      const [x, y, w, h] = b;
      await page.screenshot({
        path: `${out}/${String(++n).padStart(2, "0")}-${a}.png`,
        clip: { x: box.x + x * k, y: box.y + y * k, width: w * k, height: h * k },
      });
    } else if (op === "type") await page.keyboard.type(a);
    else if (op === "wait") await page.waitForTimeout(a);
    else if (op === "eval") log.push(`[eval] ${JSON.stringify(await page.evaluate(a))}`);
    else if (op === "room")
      await page.evaluate((id) => {
        const s = window.__quest.scene();
        const r = s.room.exits.find((e) => e.to === id);
        if (r) s.go(r);
      }, a);
    else if (op === "jump")
      await page.evaluate((id) => {
        const s = window.__quest.scene();
        const { ROOMS } = { ROOMS: s.constructor && window.__quest.rooms };
        const all = window.__quest.rooms;
        const into = all.flatMap((r) => r.exits).find((e) => e.to === id);
        const room = all.find((r) => r.id === id);
        s.enter(room, { x: into.arrive[0] * 32 + 16, y: into.arrive[1] * 32 + 16 }, into.face);
      }, a);
    else if (op === "item")
      // Stand next to an item's spot in the current room (found from the live room data).
      log.push(
        "[item] " +
          (await page.evaluate((key) => {
            const s = window.__quest.scene();
            const spot = s.room.spots.find((x) => x.item === key);
            if (!spot) return `${key} not in ${s.room.id}`;
            const [c, r] = spot.at;
            for (const [dc, dr] of [
              [0, 2],
              [0, 1],
              [1, 1],
              [-1, 1],
              [1, 0],
              [-1, 0],
              [0, 3],
              [2, 1],
              [-2, 1],
              [0, -1],
            ]) {
              const x = (c + dc) * 32 + 16;
              const y = (r + dr) * 32 + 16;
              if (!s.blocked(x, y)) {
                s.player.setPosition(x, y);
                s.vx = s.vy = 0;
                s.near = undefined;
                return `${key} at ${c + dc},${r + dr}`;
              }
            }
            s.player.setPosition(c * 32 + 16, r * 32 + 16);
            return `${key}: forced onto spot`;
          }, a)),
      );
    else if (op === "goto") await page.goto(base + a);
    else if (op === "clear") await page.evaluate(() => localStorage.clear());
    else if (op === "save") await page.evaluate((v) => localStorage.setItem("hwc.quest.practice", v), a);
    else if (op === "reload") (await page.reload(), await page.waitForTimeout(1500));
  } catch (e) {
    log.push(`[step-error] ${JSON.stringify(step)}: ${e.message}`);
  }
}
fs.writeFileSync(`${out}/console.log`, log.join("\n"));
console.log(
  log
    .filter((l) => /error|warn/i.test(l))
    .slice(0, 30)
    .join("\n"),
);
await browser.close();

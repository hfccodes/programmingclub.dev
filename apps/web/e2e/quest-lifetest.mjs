// Snow Quest NPC-life soak: node e2e/quest-lifetest.mjs <room> <who> [idleMs] [baseUrl]
// Samples every frame: player-NPC and NPC-NPC feet gaps, bark bubbles on screen at once, where NPCs rest.
import { chromium } from "@playwright/test";
const [room, who, idleMs = "25000", base = "http://localhost:3112"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errs.push(m.text()));
page.on("console", (m) => /LEFT ROOM/.test(m.text()) && console.log(m.text()));
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
await page.goto(base + "/hello-world/quest");
await page.waitForTimeout(2500);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem(
    "hwc.quest.practice",
    JSON.stringify({
      seed: 12345,
      claimed: ["z1-lights", "z1-shovel", "z1-snowman", "z2-cocoa", "z2-bulbs", "z2-note", "z3-glow", "z3-mittens", "z3-clock"],
      waits: {},
    }),
  );
});
await page.reload();
await page.waitForTimeout(2500);
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
await page.evaluate((id) => {
  const s = window.__quest.scene();
  const all = window.__quest.rooms;
  if (s.room.id !== id) {
    const into = all.flatMap((r) => r.exits).find((e) => e.to === id);
    s.enter(
      all.find((r) => r.id === id),
      { x: into.arrive[0] * 32 + 16, y: into.arrive[1] * 32 + 16 },
      into.face,
    );
  }
  const m = (window.__m = {
    minPN: 1e9,
    minPNat: "",
    minNN: 1e9,
    maxBarks: 0,
    restExit: 1e9,
    restTerm: 1e9,
    frames: 0,
    t0: performance.now(),
    moved: 0,
    both: 0,
    skip: 0,
    barkFrames: 0,
    left: 0,
  });
  window.__room = id;
  window.__ensure = () => {
    const s = window.__quest.scene();
    if (s.room.id === id) return;
    m.left++;
    const into = all.flatMap((r) => r.exits).find((e) => e.to === id);
    s.enter(
      all.find((r) => r.id === id),
      { x: into.arrive[0] * 32 + 16, y: into.arrive[1] * 32 + 16 },
      into.face,
    );
  };
  const tick = () => {
    const s = window.__quest.scene();
    m.frames++;
    const ls = s.things.filter((t) => t.life);
    let barks = 0;
    for (const t of ls) {
      const L = t.life;
      const d = Math.hypot(L.fx - s.player.x, L.fy - s.player.y);
      if (performance.now() > m.skip && d < m.minPN) {
        m.minPN = d;
        m.minPNat = L.who + " moving=" + L.moving;
      }
      if (L.bubble?.visible && String(L.bubble.getData("key")).startsWith("bark|")) {
        barks++;
        m.barkFrames++;
      }
      if (L.bubble?.visible && s.prompt.visible && s.near === t) m.both++;
      if (L.moving) m.moved++;
      else {
        for (const e of s.room.exits)
          for (const [c, r] of e.cells) m.restExit = Math.min(m.restExit, Math.hypot(c * 32 + 16 - L.fx, r * 32 + 16 - L.fy));
        for (const o of s.things)
          if (o.spot.kind === "terminal") m.restTerm = Math.min(m.restTerm, Math.hypot(o.x - L.fx, o.y + 40 - L.fy));
      }
      for (const o of ls) if (o !== t) m.minNN = Math.min(m.minNN, Math.hypot(o.life.fx - L.fx, o.life.fy - L.fy));
    }
    m.maxBarks = Math.max(m.maxBarks, barks);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, room);
const ev = (f, a) => page.evaluate(f, a);
// Idle, far from the NPC.
await page.waitForTimeout(Number(idleMs));
const idle = await ev(() => ({ ...window.__m, fps: Math.round((window.__m.frames * 1000) / (performance.now() - window.__m.t0)) }));
// Talk mid-walk.
let talk = "not tried";
for (let i = 0; i < 80; i++) {
  if (await ev((w) => !!window.__quest.scene().things.find((t) => t.life?.who === w)?.life.moving, who)) {
    await ev((w) => {
      const s = window.__quest.scene();
      if (s.room.id !== window.__room)
        console.log("LEFT ROOM for " + s.room.id + " at " + Math.round(s.player.x) + "," + Math.round(s.player.y));
      window.__ensure();
      const L = window.__quest.scene().things.find((t) => t.life?.who === w).life;
      const f = s.free(L.fx, L.fy + 64);
      s.player.setPosition(f.x, f.y);
      s.vx = s.vy = 0;
    }, who);
    await page.waitForTimeout(450);
    await page.keyboard.press("e");
    await page.waitForTimeout(500);
    const open = await ev(() => !!document.querySelector("[data-testid=quest-dialog]") && window.__quest.bridge.paused);
    for (let k = 0; k < 30 && (await ev(() => !!document.querySelector("[data-testid=quest-dialog]"))); k++) {
      await page.keyboard.press("e");
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    const closed = await ev(() => !document.querySelector("[data-testid=quest-dialog]") && !window.__quest.bridge.paused);
    talk = `midwalk dialog opened=${open} closed=${closed}`;
    break;
  }
  await page.waitForTimeout(250);
}
// Walk at the NPC from four sides, then stand on its stops while it is under way.
for (let round = 0; round < 2; round++)
  for (const [key, ox, oy] of [
    ["ArrowLeft", 170, 0],
    ["ArrowRight", -170, 0],
    ["ArrowUp", 0, 130],
    ["ArrowDown", 0, -130],
  ]) {
    await ev(
      ([w, ox, oy]) => {
        const s = window.__quest.scene();
        if (s.room.id !== window.__room)
          console.log("LEFT ROOM for " + s.room.id + " at " + Math.round(s.player.x) + "," + Math.round(s.player.y));
        window.__ensure();
        const L = window.__quest.scene().things.find((t) => t.life?.who === w).life;
        const f = s.free(L.fx + ox, L.fy + oy);
        s.player.setPosition(f.x, f.y);
        s.vx = s.vy = 0;
      },
      [who, ox, oy],
    );
    await page.keyboard.down(key);
    await page.waitForTimeout(1600);
    await page.keyboard.up(key);
    const side = key === "ArrowLeft" || key === "ArrowRight" ? "ArrowUp" : "ArrowLeft";
    await page.keyboard.down(side);
    await page.keyboard.down(key);
    await page.waitForTimeout(900);
    await page.keyboard.up(side);
    await page.keyboard.up(key);
  }
for (let k = 0; k < 6; k++) {
  await ev(
    ([w, k]) => {
      window.__ensure();
      const s = window.__quest.scene();
      const L = s.things.find((t) => t.life?.who === w).life;
      const far = s.free(L.fx > 768 ? 300 : 1200, 700);
      s.player.setPosition(far.x, far.y);
      window.__k = k;
    },
    [who, k],
  );
  // Wait for the NPC to set off, then step into its way (at least 60 px from it, as a player could).
  for (let i = 0; i < 40; i++) {
    if (await ev((w) => (window.__ensure(), window.__quest.scene().things.find((t) => t.life?.who === w).life.moving), who)) break;
    await page.waitForTimeout(250);
  }
  await ev((w) => {
    window.__ensure();
    const s = window.__quest.scene();
    const L = s.things.find((t) => t.life?.who === w).life;
    const [tx, ty] = L.stops[(L.i + 1) % L.stops.length];
    const d = Math.hypot(tx - L.fx, ty - L.fy) || 1;
    const k = Math.min(1, 100 / d);
    const x = L.fx + (tx - L.fx) * k,
      y = L.fy + (ty - L.fy) * k;
    if (!s.blocked(x, y) && Math.hypot(x - L.fx, y - L.fy) > 60) s.player.setPosition(x, y);
    s.vx = s.vy = 0;
  }, who);
  await page.waitForTimeout(2500);
}
const all = await ev(() => ({ ...window.__m, fps: Math.round((window.__m.frames * 1000) / (performance.now() - window.__m.t0)) }));
const r = (o) =>
  `minPN=${Math.round(o.minPN)}(${o.minPNat}) minNN=${Math.round(o.minNN)} maxBarks=${o.maxBarks} restExit=${Math.round(o.restExit)} restTerm=${Math.round(o.restTerm)} movedFrames=${o.moved} both=${o.both} barkFrames=${o.barkFrames} leftRoom=${o.left} fps=${o.fps}`;
const ok =
  all.minPN >= 40 && all.maxBarks <= 1 && all.restExit >= 64 && all.restTerm >= 60 && all.minNN >= 140 && !errs.length && all.both === 0;
console.log(
  `${room}:${who} ${ok ? "PASS" : "FAIL"}\n  idle: ${r(idle)}\n  all:  ${r(all)}\n  ${talk}\n  errors: ${errs.length ? errs.join(" | ") : "none"}`,
);
await browser.close();

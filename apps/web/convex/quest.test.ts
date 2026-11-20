// Snow Quest against an in-memory Convex: claims, waits, locked zones, Cup points, and the board.
import { beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { WAIT_MS, answerFor } from "../src/lib/quest";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./officers.ts": () => import("./officers"),
  "./players.ts": () => import("./players"),
  "./quest.ts": () => import("./quest"),
  "./sessions.ts": () => import("./sessions"),
};

// Made-up addresses only: the repo is public.
const ADA = "ada@officers.test";
process.env.OFFICER_EMAILS = ADA;
const T0 = Date.UTC(2026, 10, 18, 22);
let now = T0;
const later = (s: number) => setSystemTime(new Date((now += s * 1000)));
beforeEach(() => setSystemTime(new Date((now = T0))));

async function night({ started = true, practice = false } = {}) {
  const t = convexTest(schema, modules);
  const officer = t.withIdentity({ email: ADA });
  await officer.mutation(api.sessions.start, { week: 6, practice });
  const code = (await officer.query(api.sessions.joinCode, {}))!;
  const join = (i: number) => t.mutation(api.players.join, { code, name: `Student ${i}`, email: `s${i}@hawkmail.hfcc.edu` });
  const startRound = (round = 0) => officer.mutation(api.sessions.setRound, { round, double: false });
  if (started) await startRound();
  return { t, officer, join, startRound };
}

const right = async (t: Awaited<ReturnType<typeof night>>["t"], token: string, key: string) => {
  const me = (await t.query(api.quest.me, { token }))!;
  return t.mutation(api.quest.claim, { token, key, answer: answerFor(key, me.seed) ?? undefined });
};

describe("Snow Quest", () => {
  test("a rehearsal waits for the Snow Quest round before accepting any claims", async () => {
    const { t, join, startRound } = await night({ started: false, practice: true });
    const token = await join(1);
    expect((await t.query(api.quest.me, { token }))?.started).toBe(false);
    await expect(right(t, token, "z1-lights")).rejects.toThrow("The game hasn't started yet. Wait for the host.");

    await t.run((ctx) =>
      ctx.db.insert("weeks", {
        week: 6,
        title: "The Final",
        pitch: "Rehearsal",
        startsAt: T0,
        cancelled: false,
        lineup: [
          { label: "Puzzle 1", double: false },
          { label: "snow quest", double: false },
        ],
        updatedBy: ADA,
        updatedAt: T0,
      }),
    );
    await startRound();
    expect((await t.query(api.quest.me, { token }))?.started).toBe(false);
    await expect(right(t, token, "z1-lights")).rejects.toThrow("Wait for the host.");

    await startRound(1);
    expect((await t.query(api.quest.me, { token }))?.started).toBe(true);
    expect((await right(t, token, "z1-lights")).points).toBe(2);
  });

  test("a right answer gives Cup points at once; claiming again gives nothing", async () => {
    const { t, join } = await night();
    const token = await join(1);
    const r = await right(t, token, "z1-lights");
    expect(r).toEqual({ right: true, waitMs: 0, points: 2, xp: 100, leveledTo: null });
    expect(await right(t, token, "z1-lights")).toEqual({ right: true, waitMs: 0, points: 0, xp: 0, leveledTo: null });
    const live = (await t.query(api.sessions.live, {}))!;
    expect(live.teams[0].score).toBe(2);
    const me = (await t.query(api.quest.me, { token }))!;
    expect(me.claimed).toEqual(["z1-lights"]);
    expect(me.xp).toBe(100);
    expect(me.name).toBe("Student 1");
  });

  test("a wrong answer waits on the server, then the right one counts", async () => {
    const { t, join } = await night();
    const token = await join(1);
    expect(await t.mutation(api.quest.claim, { token, key: "z1-lights", answer: "13" })).toEqual({
      right: false,
      waitMs: WAIT_MS,
      points: 0,
      xp: 0,
      leveledTo: null,
    });
    const waiting = await t.mutation(api.quest.claim, { token, key: "z1-lights", answer: "14" });
    expect(waiting.right).toBe(false);
    expect(waiting.waitMs).toBe(WAIT_MS);
    later(WAIT_MS / 1000);
    expect((await t.mutation(api.quest.claim, { token, key: "z1-lights", answer: "14" })).right).toBe(true);
  });

  test("locked zones refuse; leveling up opens them and adds the level bonus", async () => {
    const { t, join } = await night();
    const token = await join(1);
    await expect(right(t, token, "z2-cocoa")).rejects.toThrow("Reach level 2");
    await right(t, token, "z1-lights");
    const secret = await t.mutation(api.quest.claim, { token, key: "z1-snowman" });
    expect(secret).toEqual({ right: true, waitMs: 0, points: 2 + 2, xp: 100, leveledTo: 2 });
    expect((await right(t, token, "z2-cocoa")).right).toBe(true);
    const me = (await t.query(api.quest.me, { token }))!;
    expect(me.level).toBe(2);
    expect(me.points).toBe(2 + 2 + 2 + 4);
    expect((await t.query(api.sessions.live, {}))!.teams[0].score).toBe(me.points);
  });

  test("an answer is needed for a puzzle; unknown keys and ended nights refuse", async () => {
    const { t, officer, join } = await night();
    const token = await join(1);
    await expect(t.mutation(api.quest.claim, { token, key: "z1-lights" })).rejects.toThrow("Type your answer");
    await expect(t.mutation(api.quest.claim, { token, key: "nope" })).rejects.toThrow("isn’t part");
    await right(t, token, "z1-lights");
    await officer.mutation(api.sessions.end, {});
    await expect(right(t, token, "z1-shovel")).rejects.toThrow("This night has ended.");
    // The game keeps showing what the player saved (not practice), marked ended.
    const after = (await t.query(api.quest.me, { token }))!;
    expect([after.ended, after.points, after.claimed]).toEqual([true, 2, ["z1-lights"]]);
    const final = (await t.query(api.sessions.final, {}))!;
    expect(JSON.stringify(final)).toContain("Student 1");
  });

  test("the board lists every player, best first, with levels; players get different inputs", async () => {
    const { t, join } = await night();
    const a = await join(1);
    const b = await join(2);
    for (const key of ["z1-lights", "z1-shovel", "z2-cocoa"]) await right(t, b, key);
    const board = (await t.query(api.quest.board, {}))!;
    expect(board.map((r) => [r.name, r.points, r.level])).toEqual([
      ["Student 2", 2 + 3 + 2 + 4, 2],
      ["Student 1", 0, 1],
    ]);
    const [ma, mb] = [(await t.query(api.quest.me, { token: a }))!, (await t.query(api.quest.me, { token: b }))!];
    expect(ma.seed === mb.seed).toBe(false);
  });
});

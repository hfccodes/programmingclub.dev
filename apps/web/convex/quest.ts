import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { award, openSession, sessionTeams, teamByToken } from "./lib";
import { WEEKS } from "../src/lib/content";
import { LEVELS, WAIT_MS, check, itemByKey, levelFor, questSeed } from "../src/lib/quest";

// Snow Quest, the season Final. Players claim puzzles and secrets from the game (/hello-world/quest) with the token from
// their join page. Answers are checked here from the player's own seed, and every claim and level-up adds Cup points
// to their (solo) team at once, so the TV's scoreboard moves all night. Items and levels live in src/lib/quest.ts.

const isLevelRow = (key: string) => key.startsWith("level:");

async function questStarted(ctx: QueryCtx, { week, round }: Doc<"sessions">) {
  if (round === undefined || round < 0 || !Number.isInteger(round)) return false;
  const edited = await ctx.db
    .query("weeks")
    .withIndex("by_week", (q) => q.eq("week", week))
    .unique();
  const label = edited ? edited.lineup.at(round)?.label : WEEKS[week - 1]?.games.at(round);
  return label !== undefined && /Snow Quest/i.test(label);
}

/** A player's quest rows tonight: what they claimed and the level-ups they got points for. */
const teamRows = (ctx: QueryCtx, teamId: Id<"teams">) =>
  ctx.db
    .query("quest")
    .withIndex("by_team_key", (q) => q.eq("teamId", teamId))
    .collect();

const totals = (rows: { key: string; xp: number; points: number }[]) => {
  const xp = rows.reduce((n, r) => n + r.xp, 0);
  return { xp, level: levelFor(xp), points: rows.reduce((n, r) => n + r.points, 0) };
};

/**
 * Claims a puzzle (with its answer) or a secret. Idempotent: claiming something again gives nothing. A wrong answer
 * locks that item for WAIT_MS. Returns what this claim earned: Cup points (with any level-up bonus) and xp.
 */
export const claim = mutation({
  args: { token: v.string(), key: v.string(), answer: v.optional(v.string()) },
  returns: v.object({
    right: v.boolean(),
    waitMs: v.number(),
    points: v.number(),
    xp: v.number(),
    leveledTo: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { token, key, answer }) => {
    const { s, teamId } = await teamByToken(ctx, token);
    if (!(await questStarted(ctx, s))) throw new ConvexError("The game hasn't started yet. Wait for the host.");
    const item = itemByKey(key);
    if (!item) throw new ConvexError("That isn’t part of Snow Quest.");
    const rows = await teamRows(ctx, teamId);
    const none = { right: true, waitMs: 0, points: 0, xp: 0, leveledTo: null as number | null };
    if (rows.some((r) => r.key === key)) return none;
    const before = totals(rows);
    if (item.zone > before.level) throw new ConvexError(`Reach level ${item.zone} to open this one.`);

    const now = Date.now();
    if (item.question) {
      const a = (answer ?? "").trim();
      if (!a) throw new ConvexError("Type your answer first.");
      if (a.length > 200) throw new ConvexError("That answer is too long.");
      const tries = await ctx.db
        .query("questTries")
        .withIndex("by_team_key", (q) => q.eq("teamId", teamId).eq("key", key))
        .unique();
      if (tries && now < tries.waitUntil) return { ...none, right: false, waitMs: tries.waitUntil - now };
      if (!check(key, questSeed(s._id, teamId), a)) {
        const t = { wrong: (tries?.wrong ?? 0) + 1, waitUntil: now + WAIT_MS, lastWrong: a };
        if (tries) await ctx.db.patch(tries._id, t);
        else await ctx.db.insert("questTries", { sessionId: s._id, teamId, key, ...t });
        return { ...none, right: false, waitMs: WAIT_MS };
      }
    }

    await ctx.db.insert("quest", { sessionId: s._id, teamId, key, points: item.points, xp: item.xp, at: now });
    const xp = before.xp + item.xp;
    let points = item.points;
    for (const l of LEVELS)
      if (l.xp > before.xp && l.xp <= xp && !rows.some((r) => r.key === `level:${l.level}`)) {
        await ctx.db.insert("quest", { sessionId: s._id, teamId, key: `level:${l.level}`, points: l.points, xp: 0, at: now });
        points += l.points;
      }
    await award(ctx, teamId, points);
    const level = levelFor(xp);
    return { right: true, waitMs: 0, points, xp: item.xp, leveledTo: level > before.level ? level : null };
  },
});

/** The game's view of one player: their seed, what they've claimed, xp, level, and quest points. Null when this
 *  token isn't on a team for a night that is open or has ended (the game then runs in practice mode). After End night
 *  it still answers, with `ended`, so the game keeps showing the player's saved points instead of falling back to
 *  practice; claims are refused then (teamByToken). */
export const me = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      sessionId: v.id("sessions"),
      ended: v.boolean(),
      started: v.boolean(),
      teamId: v.id("teams"),
      name: v.string(),
      seed: v.number(),
      claimed: v.array(v.string()),
      xp: v.number(),
      level: v.number(),
      points: v.number(),
      waits: v.record(v.string(), v.number()),
    }),
  ),
  handler: async (ctx, { token }) => {
    const a = await ctx.db
      .query("attendance")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    const s = a && (await ctx.db.get(a.sessionId));
    if (!a || !s || !a.teamId) return null;
    const team = await ctx.db.get(a.teamId);
    const player = await ctx.db.get(a.playerId);
    const rows = await teamRows(ctx, a.teamId);
    const tries = await ctx.db
      .query("questTries")
      .withIndex("by_team_key", (q) => q.eq("teamId", a.teamId!))
      .collect();
    return {
      sessionId: s._id,
      ended: s.status !== "open",
      started: await questStarted(ctx, s),
      teamId: a.teamId,
      name: player?.name ?? team?.name ?? "You",
      seed: questSeed(s._id, a.teamId),
      claimed: rows.filter((r) => !isLevelRow(r.key)).map((r) => r.key),
      ...totals(rows),
      waits: Object.fromEntries(tries.filter((t) => t.waitUntil > Date.now()).map((t) => [t.key, t.waitUntil])),
    };
  },
});

/** Public, for the game and the TV: every player tonight with their Cup points and quest level, best first. */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const s = await openSession(ctx);
    if (!s) return null;
    const [teams, rows] = await Promise.all([
      sessionTeams(ctx, s._id),
      ctx.db
        .query("quest")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect(),
    ]);
    return teams
      .map((t) => {
        const mine = rows.filter((r) => r.teamId === t._id);
        return {
          teamId: t._id,
          name: t.name,
          points: t.score,
          level: totals(mine).level,
          found: mine.filter((r) => itemByKey(r.key)?.kind === "secret").length,
          solved: mine.filter((r) => itemByKey(r.key)?.kind === "puzzle").length,
        };
      })
      .sort((a, b) => b.points - a.points || b.level - a.level || a.name.localeCompare(b.name));
  },
});

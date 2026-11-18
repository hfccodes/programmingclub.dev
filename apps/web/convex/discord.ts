// Discord verification: a signed-in HawkMail starts here, Discord sends the member back to `callback` (routed in
// http.ts), and the club's bot gives them their roles, adding them to the server if they aren't in it yet.
// Env on each deployment: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and SITE_URL
// (where to send members back; https://programmingclub.dev when unset). The app's OAuth redirect is
// `${CONVEX_SITE_URL}/discord/callback`.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { isOfficerEmail } from "./officers";
import { MANAGED_ROLES, cleanInterests, kindOf, mergeRoles, rolesFor, suggestedInterests } from "../src/lib/discord";
import { isHfcEmail } from "../src/lib/season";

const API = "https://discord.com/api/v10";
const STATE_TTL = 15 * 60 * 1000;

const redirectUri = () => `${process.env.CONVEX_SITE_URL}/discord/callback`;

async function verifier(ctx: QueryCtx) {
  const email = (await ctx.auth.getUserIdentity())?.email?.toLowerCase();
  return email ? { email, eligible: isHfcEmail(email) || isOfficerEmail(email) } : null;
}

const linkOf = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("discord")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

/** The signed-in member: whether they can verify, the Discord account they linked, and interests to start from. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await verifier(ctx);
    if (!me) return null;
    const [link, survey] = await Promise.all([
      linkOf(ctx, me.email),
      ctx.db
        .query("survey")
        .withIndex("by_email", (q) => q.eq("email", me.email))
        .unique(),
    ]);
    return {
      ...me,
      link: link && { username: link.username, verifiedAt: link.verifiedAt },
      interests: link?.interests ?? suggestedInterests(survey?.interests ?? []),
      // Not secret: for the "Open Discord" link.
      guild: process.env.DISCORD_GUILD_ID ?? null,
    };
  },
});

/** "Connect Discord": remembers what they picked and returns Discord's authorize page to send them to. */
export const start = mutation({
  args: { interests: v.array(v.string()) },
  handler: async (ctx, { interests }) => {
    const me = await verifier(ctx);
    if (!me) throw new ConvexError("You’re signed out. Sign in with your HawkMail first.");
    if (!me.eligible) throw new ConvexError("Sign in with your HawkMail (@hawkmail.hfcc.edu). The club is for HFC students.");
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) throw new ConvexError("Discord verification isn’t set up yet. Message an officer.");
    for (const old of await ctx.db
      .query("discordStates")
      .withIndex("by_email", (q) => q.eq("email", me.email))
      .collect())
      await ctx.db.delete(old._id);
    const state = crypto.randomUUID();
    await ctx.db.insert("discordStates", {
      state,
      email: me.email,
      kind: kindOf(me.email),
      interests: cleanInterests(interests),
      createdAt: Date.now(),
    });
    const q = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      scope: "identify guilds.join",
      state,
    });
    return `https://discord.com/oauth2/authorize?${q}`;
  },
});

/** The click Discord sent back, used once and only within 15 minutes. */
export const take = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("discordStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    return Date.now() - row.createdAt > STATE_TTL ? null : { email: row.email, kind: row.kind, interests: row.interests };
  },
});

/** Records who verified as which Discord account. Returns the account this email had before, if it was a different one. */
export const link = internalMutation({
  args: { email: v.string(), discordId: v.string(), username: v.string(), interests: v.array(v.string()) },
  handler: async (ctx, { email, discordId, username, interests }) => {
    // One HawkMail per Discord account: an account verified by someone else before now belongs to this email.
    for (const other of await ctx.db
      .query("discord")
      .withIndex("by_discord", (q) => q.eq("discordId", discordId))
      .collect())
      if (other.email !== email) await ctx.db.delete(other._id);
    const row = await linkOf(ctx, email);
    const verifiedAt = Date.now();
    if (!row) {
      await ctx.db.insert("discord", { email, discordId, username, interests, verifiedAt });
      return null;
    }
    await ctx.db.patch(row._id, { discordId, username, interests, verifiedAt });
    return row.discordId === discordId ? null : row.discordId;
  },
});

/* ---------- Discord's API ---------- */

class DiscordError extends Error {}

async function discord<T>(path: string, auth: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "User-Agent": "DiscordBot (https://programmingclub.dev, 1)",
      ...init.headers,
    },
  });
  if (!res.ok) throw new DiscordError(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

const bot = () => `Bot ${process.env.DISCORD_BOT_TOKEN}`;
const guild = () => process.env.DISCORD_GUILD_ID;

/** Role ids by name, for the roles verifying hands out. */
async function roleIds() {
  const roles = (await discord<{ id: string; name: string }[]>(`/guilds/${guild()}/roles`, bot())) ?? [];
  return (names: readonly string[]) =>
    names.map((n) => {
      const id = roles.find((r) => r.name === n)?.id;
      if (!id) throw new DiscordError(`No role named "${n}" on the server.`);
      return id;
    });
}

/** Adds them to the server with these roles, or, if they're already in it, swaps their verification roles for these. */
async function giveRoles(userId: string, accessToken: string, give: string[], managed: string[]) {
  const member = `/guilds/${guild()}/members/${userId}`;
  const added = await discord(member, bot(), { method: "PUT", body: JSON.stringify({ access_token: accessToken, roles: give }) });
  if (added) return; // 201: just joined, with the roles
  const { roles } = (await discord<{ roles: string[] }>(member, bot()))!;
  await discord(member, bot(), { method: "PATCH", body: JSON.stringify({ roles: mergeRoles(roles, managed, give) }) });
}

/** Takes the verification roles back from an account this email no longer uses (if it's still in the server). */
async function stripRoles(userId: string, managed: string[]) {
  const member = `/guilds/${guild()}/members/${userId}`;
  const current = await discord<{ roles: string[] }>(member, bot()).catch(() => null);
  if (current) await discord(member, bot(), { method: "PATCH", body: JSON.stringify({ roles: mergeRoles(current.roles, managed, []) }) });
}

async function exchange(code: string) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new DiscordError(`token: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** We only need the token once: hand it back so it can't be used again. */
const revoke = (token: string) =>
  fetch(`${API}/oauth2/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID!, client_secret: process.env.DISCORD_CLIENT_SECRET!, token }),
  }).catch(() => undefined);

/** Where Discord sends members after they authorize: verify, give roles, and send them back to the site. */
export const callback = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const back = (q: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${process.env.SITE_URL ?? "https://programmingclub.dev"}/discord?${q}` },
    });
  const state = url.searchParams.get("state");
  const pending = state ? await ctx.runMutation(internal.discord.take, { state }) : null;
  if (!pending) return back("error=expired");
  const code = url.searchParams.get("code");
  if (!code) return back("error=denied");
  try {
    const token = await exchange(code);
    try {
      const user = (await discord<{ id: string; username: string }>("/users/@me", `Bearer ${token}`))!;
      const ids = await roleIds();
      const managed = ids(MANAGED_ROLES);
      await giveRoles(user.id, token, ids(rolesFor(pending.kind, pending.interests)), managed);
      const before = await ctx.runMutation(internal.discord.link, {
        email: pending.email,
        discordId: user.id,
        username: user.username,
        interests: pending.interests,
      });
      if (before) await stripRoles(before, managed);
      return back(`done=${encodeURIComponent(user.username)}`);
    } finally {
      await revoke(token);
    }
  } catch (e) {
    console.error(e);
    return back("error=failed");
  }
});

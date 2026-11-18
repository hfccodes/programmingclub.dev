// Discord verification: only HawkMail (and officers) can start, and the callback gives the right roles, swaps them when
// someone verifies again, and moves them off an old account. Discord's API is faked; nothing leaves the test.
import { afterEach, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import { BLANK } from "../src/lib/survey";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./officers.ts": () => import("./officers"),
  "./survey.ts": () => import("./survey"),
  "./discord.ts": () => import("./discord"),
  "./http.ts": () => import("./http"),
};

// Made-up addresses and ids only: the repo is public.
const ADA = "ada@officers.test";
const SAM = "sam@hawkmail.hfcc.edu";
const PROF = "prof@hfcc.edu";
Object.assign(process.env, {
  OFFICER_EMAILS: ADA,
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  DISCORD_BOT_TOKEN: "token",
  DISCORD_GUILD_ID: "guild",
  CONVEX_SITE_URL: "https://test.convex.site",
  SITE_URL: "https://site.test",
});

const ROLES = [
  "Member",
  "Faculty & Staff",
  "Officer",
  "Game Nights",
  "AI",
  "Web & Apps",
  "Game Dev",
  "Security & CTFs",
  "Careers & Interviews",
  "Hackathons",
  "Class Help",
].map((name, i) => ({ id: `r${i}`, name }));
const id = (name: string) => ROLES.find((r) => r.name === name)!.id;

/** A fake Discord: who's signed in on the OAuth token, and each member's roles on the server. */
function fakeDiscord(user: { id: string; username: string }, members: Map<string, string[]>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.endsWith("/oauth2/token")) return json({ access_token: "access" });
    if (url.endsWith("/oauth2/token/revoke")) return json({});
    if (url.endsWith("/users/@me")) return json(user);
    if (url.endsWith("/guilds/guild/roles")) return json(ROLES);
    const m = url.match(/\/guilds\/guild\/members\/(\w+)$/);
    if (m) {
      const roles = members.get(m[1]);
      const body = init?.body ? (JSON.parse(String(init.body)) as { roles: string[] }) : null;
      if (method === "PUT") {
        if (roles) return new Response(null, { status: 204 });
        members.set(m[1], body!.roles);
        return json({}, 201);
      }
      if (!roles) return json({ message: "Unknown Member" }, 404);
      if (method === "PATCH") members.set(m[1], body!.roles);
      return json({ roles: members.get(m[1]) });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  });
  return () => (globalThis.fetch = real);
}
let restore = () => {};
afterEach(() => restore());

const rejects = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (e: { data?: unknown }) => e,
  );
  return error ? String(error.data) : null;
};

/** Starts verifying as `who`, then lands on the callback the way Discord would send them back. */
async function verify(t: ReturnType<typeof convexTest>, who: string, interests: string[]) {
  const url = new URL(await t.withIdentity({ email: who }).mutation(api.discord.start, { interests }));
  expect(url.searchParams.get("redirect_uri")).toBe("https://test.convex.site/discord/callback");
  const res = await t.fetch(`/discord/callback?code=c&state=${url.searchParams.get("state")}`);
  return new URL(res.headers.get("Location")!);
}

test("only HawkMail and officers can start, and interests start from the survey", async () => {
  const t = convexTest(schema, modules);
  expect(await rejects(t.mutation(api.discord.start, { interests: [] }))).toContain("signed out");
  expect(await rejects(t.withIdentity({ email: "sam@gmail.com" }).mutation(api.discord.start, { interests: [] }))).toContain("HawkMail");
  expect(await t.withIdentity({ email: ADA }).mutation(api.discord.start, { interests: [] })).toContain("discord.com/oauth2/authorize");

  const sam = t.withIdentity({ email: SAM });
  await sam.mutation(api.survey.save, {
    name: "Sam",
    ...BLANK,
    interests: ["ai", "interviews"],
    experience: "basics",
    frequency: "weekly",
    locations: ["campus"],
  });
  expect((await sam.query(api.discord.mine, {}))?.interests).toEqual(["ai", "careers"]);
});

test("verifying joins the server with roles, verifying again swaps them, and a new account takes them over", async () => {
  const t = convexTest(schema, modules);
  const members = new Map<string, string[]>();
  restore = fakeDiscord({ id: "u1", username: "sam" }, members);

  const done = await verify(t, SAM, ["ai", "nope"]);
  expect(done.origin + done.pathname).toBe("https://site.test/discord/verify");
  expect(done.searchParams.get("done")).toBe("sam");
  expect(members.get("u1")).toEqual([id("Member"), id("AI")]);

  // An officer gave them a role by hand; verifying again with other interests keeps it.
  members.set("u1", [...members.get("u1")!, id("Officer")]);
  await verify(t, SAM, ["gamedev"]);
  expect(members.get("u1")!.sort()).toEqual([id("Member"), id("Officer"), id("Game Dev")].sort());
  expect((await t.withIdentity({ email: SAM }).query(api.discord.mine, {}))?.link?.username).toBe("sam");

  // Same HawkMail, new Discord account: the old one loses its verification roles.
  restore();
  restore = fakeDiscord({ id: "u2", username: "sam2" }, members);
  await verify(t, SAM, []);
  expect(members.get("u2")).toEqual([id("Member")]);
  expect(members.get("u1")).toEqual([id("Officer")]);
});

test("faculty and staff get their own role, and a used or unknown state can't be replayed", async () => {
  const t = convexTest(schema, modules);
  const members = new Map<string, string[]>();
  restore = fakeDiscord({ id: "u3", username: "prof" }, members);
  await verify(t, PROF, []);
  expect(members.get("u3")).toEqual([id("Faculty & Staff")]);

  const res = await t.fetch("/discord/callback?code=c&state=made-up");
  expect(new URL(res.headers.get("Location")!).searchParams.get("error")).toBe("expired");
});

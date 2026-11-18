// The club desktop's apps: what each window shows. Content comes from lib/season.ts and the live schedule.
import { Tabs } from "@base-ui/react/tabs";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { InstagramLink } from "#/components/instagram";
import { Disclaimer } from "#/components/site";
import { GAME_TILE, Loading, Picto, weekTile } from "#/components/ui";
import { GAMES } from "#/lib/content";
import { NOT_ANNOUNCED, PACK, PAST, TIPS, WEEKEND, dateParts, shortWhen, upcoming } from "#/lib/hackathons";
import type { Hackathon } from "#/lib/hackathons";
import { STAGES } from "#/lib/learn";
import type { Price, Stage } from "#/lib/learn";
import { nextMeeting, useSchedule } from "#/lib/schedule";
import { CALENDAR, CLUB, OFFICERS, REPO_URL, fmtDate, isHalloweenMonth, roomFor } from "#/lib/season";
import { api } from "../../../convex/_generated/api";
import { Dashboard } from "./dashboard";

export type AppId =
  "about" | "meetings" | "world-cup" | "learn" | "hackathons" | "officers" | "join" | "discord" | "contribute" | "site" | "dashboard";

export interface App {
  id: AppId;
  path: string;
  /** Window title, styled like a file name. */
  title: string;
  /** Desktop icon label. */
  label: string;
  /** Line glyph on a 24-unit grid, drawn in currentColor. */
  glyph: ReactNode;
  /** Default window placement (percent of the desktop) and width. */
  at: { left: number; top: number };
  width: string;
  Content: () => ReactNode;
  /** Only signed-in officers see its icon. */
  officer?: boolean;
}

export const mailto = `mailto:${CLUB.advisor.email}?subject=${encodeURIComponent("Programming Club")}`;

const G = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/* ---------- about: welcome.txt ---------- */

function About() {
  return (
    <div className="space-y-5">
      <pre className="code text-[0.95rem]">
        <span className="font-bold">if</span> (curious) {"{"}
        {"\n"}
        {"  "}
        <span className="font-bold text-[#ffb547]">build</span>();{"\n"}
        {"  "}
        <span className="font-bold text-[#9fd3ff]">debug</span>();{"\n"}
        {"  "}
        <span className="font-bold text-[#ff8fa3]">belong</span>();{"\n"}
        {"}"}
      </pre>
      <p className="text-lg leading-relaxed">
        We’re {CLUB.name} at {CLUB.school}. All skill levels welcome. We build projects, play team coding games, and help each other learn,
        in whatever language you’re studying.
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-[0.95rem]">
        {[
          ["Who can join", CLUB.eligibility],
          ["Experience", "None needed"],
          ["Cost", "Free. No dues."],
          ["When", `${CLUB.day}, ${CLUB.time}`],
          ["Where", CLUB.room],
          ["Languages", "Any"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-dim">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <InstagramLink className="link" />
    </div>
  );
}

/* ---------- meetings: the live season calendar ---------- */

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function countdown(start: number, now: number) {
  const mins = Math.max(0, Math.floor((start - now) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `in ${d} day${d > 1 ? "s" : ""}, ${h} hr`;
  if (h > 0) return `in ${h} hr ${m} min`;
  return `in ${m} min`;
}

function Meetings() {
  const plan = useSchedule();
  const now = useNow();
  const next = now === null ? null : nextMeeting(plan, now);
  const costume = plan.find((w) => w.bonus && /costume/i.test(w.bonus) && !w.cancelled);
  return (
    <div>
      {next && now !== null && (
        <div className="mb-5 flex items-center gap-4 rounded-[8px] bg-mist p-4">
          <span className={`tile ${weekTile(plan[next.i]).tile} size-14 shrink-0 rounded-[6px]`}>
            <Picto id={weekTile(plan[next.i]).picto} className="absolute inset-[12%]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-dim">
              {next.live ? "Happening now" : `Next meeting, ${countdown(plan[next.i].start.getTime(), now)}`}
            </p>
            <p className="text-lg leading-tight font-extrabold">{plan[next.i].title}</p>
            <p className="text-sm">
              {fmtDate(plan[next.i].start, { weekday: "long", month: "long", day: "numeric" })}, {CLUB.time}, {roomFor(plan[next.i].start)}
            </p>
            {plan[next.i].bonus && <p className="mt-1 text-sm font-semibold text-[#c2410c]">{plan[next.i].bonus}</p>}
          </div>
        </div>
      )}
      {/* Up top, so it's in view when the window opens; the season list below can run long. */}
      <h3 className="text-sm font-bold text-dim">Add to your calendar</h3>
      <div className="mt-2 mb-5 grid grid-cols-2 gap-2">
        <a href={CALENDAR.subscribe} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
          Google ↗
        </a>
        <a href={CALENDAR.webcal} className="btn btn-sm">
          Apple / Outlook
        </a>
      </div>
      {isHalloweenMonth() && costume && costume !== (next && plan[next.i]) && (
        <p className="mb-4 text-sm font-semibold text-[#c2410c]">Come to {costume.title} in costume for +3 XP.</p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-dim">This season</h3>
        <Link to="/hello-world/season" className="link text-sm">
          Every week’s games
        </Link>
      </div>
      <ol className="divide-y divide-line">
        {plan.map((w, i) => {
          const past = next ? i < next.i : now !== null;
          return (
            <li key={w.week} className={`flex items-center gap-3 py-2 ${past || w.cancelled ? "opacity-45" : ""}`}>
              <span className="narrow w-14 shrink-0 text-sm font-bold text-dim">
                {fmtDate(w.start, { month: "short", day: "numeric" })}
              </span>
              <span className={`min-w-0 flex-1 truncate font-semibold ${w.cancelled ? "line-through" : ""}`}>{w.title}</span>
              {w.kind === "cup" && <span className="chip bg-gold">Cup night</span>}
              {next?.i === i && <span className="chip bg-[#0b4fa3] text-white">Next</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- world-cup: this season's event ---------- */

function WorldCup() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[6px]">
        {GAMES.map((g) => (
          <span key={g.id} className={`tile ${GAME_TILE[g.id].tile} block aspect-square`}>
            <Picto id={GAME_TILE[g.id].picto} animate="loop" className="absolute inset-[14%]" />
          </span>
        ))}
      </div>
      <h3 className="mt-5 text-2xl lowercase">hello, world cup</h3>
      <p className="mt-2 leading-relaxed">
        Season 0 is a coding game league: eight Wednesdays of Wikipedia races, bug hunts, and code relays. No experience needed, and you can
        start any week.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/hello-world" className="btn btn-primary btn-sm">
          Open Hello, World Cup
        </Link>
        <Link to="/hello-world/rules" className="btn btn-sm">
          See the six games
        </Link>
      </div>
      <p className="mt-4 border-t border-line pt-4 text-sm text-dim">
        Game-night photos and results go up on Instagram. <InstagramLink className="link text-ink" />
      </p>
    </div>
  );
}

/* ---------- officers: contacts ---------- */

function Officers() {
  const officers = OFFICERS.filter((o) => o.name && o.role !== "Faculty advisor");
  return (
    <div>
      <ul className="divide-y divide-line">
        {officers.map((o) => (
          <li key={o.name} className="flex items-center gap-3 py-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-sm font-extrabold">
              {o.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <span className="block leading-tight font-bold">{o.name}</span>
              <span className="text-sm text-dim">{o.role}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-[8px] bg-mist p-4">
        <p className="text-sm text-dim">Faculty advisor</p>
        <p className="font-extrabold">{CLUB.advisor.name}</p>
        <p className="text-sm">
          <a href={mailto} className="link">
            {CLUB.advisor.email}
          </a>
          <span className="text-dim">, office {CLUB.advisor.office}</span>
        </p>
        <a href={mailto} className="btn btn-primary btn-sm mt-3">
          Email the advisor
        </a>
      </div>
    </div>
  );
}

/* ---------- join: a setup wizard ---------- */

const STEPS = [
  { title: "Come to a meeting", body: `${CLUB.day}, ${CLUB.time}, in ${CLUB.room}. Any week is a good week to start.` },
  { title: "Join the game", body: "Scan the code on the TV and sign in with your name and HawkMail. You’re in the game in a minute." },
  {
    title: "Tell us what you want to do",
    body: `Email ${CLUB.advisor.name} your interests to get on the member list, or fill out a Club Interest form with the Office of Student Activities in M-105.`,
  },
];

function Join() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  return (
    <div className="flex min-h-64 flex-col">
      <p className="text-sm text-dim">
        Step {step + 1} of {STEPS.length}. {CLUB.eligibility}. No application, no fee.
      </p>
      <div className="mt-3 flex gap-1" aria-hidden>
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#0b4fa3]" : "bg-line"}`} />
        ))}
      </div>
      <h3 className="mt-5 text-2xl">{s.title}</h3>
      <p className="mt-2 leading-relaxed">{s.body}</p>
      <div className="mt-auto flex justify-between gap-2 border-t border-line pt-4">
        <button className="btn btn-sm" onClick={() => setStep(step - 1)} disabled={step === 0}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary btn-sm" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <a href={mailto} className="btn btn-primary btn-sm">
            Email the advisor
          </a>
        )}
      </div>
    </div>
  );
}

/* ---------- discord: the club server ---------- */

const CHANNELS = ["help", "projects", "ai", "gamedev", "cybersecurity", "opportunities"];

function Discord() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-2xl">Keep coding between meetings</h3>
          <p className="leading-relaxed">
            Ask questions, show what you’re building, and find teammates. Meetings show up as events, so you get a reminder before
            Wednesday.
          </p>
        </div>
        {/* Desktop visitors are usually on a laptop: scan to join on the phone, where Discord lives. */}
        <QRCodeSVG
          value={`https://${CLUB.url}/discord`}
          title="Scan to join the club Discord"
          size={512}
          marginSize={2}
          className="h-auto w-28 shrink-0 rounded-[6px] max-md:hidden"
        />
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Some of the channels">
        {CHANNELS.map((c) => (
          <li key={c} className="chip font-mono">
            #{c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <Link to="/discord" className="btn btn-primary btn-sm">
          Join with HawkMail
        </Link>
        <p className="text-sm text-dim">For HFC students: sign in with your HawkMail, connect Discord, and you’re in.</p>
      </div>
    </div>
  );
}

/* ---------- contribute: CONTRIBUTING.md, the site is open source ---------- */

const HELP_WITH = [
  ["Fix something small", "A typo, a button that looks off on your phone, a broken link. Small pull requests are the best first ones."],
  ["Make a game better", "New puzzles and bugs for game nights, or a fix for something that annoyed you mid-round."],
  ["Build a new app", "Every window on this desktop is one file’s worth of React. Add your own."],
] as const;

function Contribute() {
  return (
    <div className="space-y-5">
      <p className="text-lg leading-relaxed">
        This whole site is open source, built by club members: the desktop, the game nights, even the Discord bot. Read the code, run it on
        your laptop, and send a pull request.
      </p>
      <pre className="code text-[0.8rem] whitespace-pre-wrap [overflow-wrap:anywhere]">
        <span className="text-[#9fd3ff]">git clone</span> {REPO_URL}
      </pre>
      <ul className="space-y-3">
        {HELP_WITH.map(([title, body]) => (
          <li key={title} className="border-l-[3px] border-school pl-3">
            <p className="font-bold">{title}</p>
            <p className="text-[0.95rem] text-dim">{body}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
          View the code
        </a>
        <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
          How to contribute
        </a>
        <a href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noopener noreferrer" className="link ml-1 text-sm">
          Report a bug
        </a>
      </div>
      <p className="text-sm text-dim">
        New to Git? That’s fine. An officer reviews every pull request, and your work shows up on your GitHub profile.
      </p>
    </div>
  );
}

/* ---------- site: about this site (required disclaimer) ---------- */

function Site() {
  return (
    <div className="space-y-4">
      <Disclaimer className="text-[0.95rem] leading-relaxed" />
      <p className="text-sm text-dim">
        Questions about student clubs? Office of Student Activities, M-105,{" "}
        <a href="mailto:studentactivities@hfcc.edu" className="link">
          studentactivities@hfcc.edu
        </a>
        .
      </p>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link to="/privacy" className="link">
          Privacy policy
        </Link>
        <Link to="/terms" className="link">
          Terms of use
        </Link>
        <Link to="/hello-world/host" className="link">
          Officer sign-in
        </Link>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="link">
          Source code
        </a>
      </p>
    </div>
  );
}

/* ---------- registry ---------- */

/* ---------- hackathons: student hackathons near campus (lib/hackathons.ts) ---------- */

// The window is a file folder: each hackathon is a tab in its own color, and the poster under it is the same color field.
const TAB =
  "press relative flex min-w-0 flex-col rounded-t-[10px] bg-mist px-2.5 pt-2 pb-2.5 text-left leading-tight text-dim outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#1f63d6] data-[active]:bg-(--c) data-[active]:text-ink";

function Hackathons() {
  // Which events show depends on today's date, so render once the client knows it; a server-rendered guess could
  // disagree with the browser's (a deadline or an event ending in between) and break hydration.
  const now = useNow();
  const [picked, setPicked] = useState<string | null>(null);
  if (now === null) return <Loading className="min-h-64" />;
  const next = upcoming(now);
  const ids = [...next.map((h) => h.id), "guide"];
  const tab = picked && ids.includes(picked) ? picked : (ids.at(0) ?? null);
  return (
    <div>
      <Tabs.Root value={tab} onValueChange={(v) => setPicked(v as string)}>
        <Tabs.List
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}
          aria-label="Hackathons near campus"
        >
          {next.map((h) => (
            <Tabs.Tab key={h.id} value={h.id} className={TAB} style={{ "--c": h.color } as CSSProperties}>
              <span className="narrow text-[0.8rem] font-bold tracking-[0.08em] uppercase">{shortWhen(h)}</span>
              <span className="narrow truncate text-[1.05rem] font-extrabold">{h.name.replace(/ \d{4}$/, "")}</span>
            </Tabs.Tab>
          ))}
          <Tabs.Tab value="guide" className={TAB} style={{ "--c": "var(--color-meadow)" } as CSSProperties}>
            <span className="narrow text-[0.8rem] font-bold tracking-[0.08em] uppercase">First time?</span>
            <span className="narrow truncate text-[1.05rem] font-extrabold">How it works</span>
          </Tabs.Tab>
        </Tabs.List>
        {next.map((h) => (
          <Tabs.Panel key={h.id} value={h.id} className="learn-panel outline-none">
            <Poster h={h} now={now} />
          </Tabs.Panel>
        ))}
        <Tabs.Panel value="guide" className="learn-panel outline-none">
          <HowItWorks />
        </Tabs.Panel>
      </Tabs.Root>
      {next.length === 0 && <p className="mt-4 font-semibold">Nothing nearby is announced yet. Check back soon.</p>}
      <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm text-dim">
        {NOT_ANNOUNCED.map((h) => (
          <p key={h.name}>
            <a href={h.url} target="_blank" rel="noreferrer" className="link text-ink">
              {h.name}
            </a>{" "}
            ({h.place}, usually in {h.usually}) hasn’t posted dates yet. {h.drive}.
          </p>
        ))}
        <p>Student hackathons within two hours of campus. Hosted by other schools, not by our club.</p>
      </div>
    </div>
  );
}

function Poster({ h, now }: { h: Hackathon; now: number }) {
  const d = dateParts(h, now);
  const due = h.deadline && new Date(h.deadline.at).getTime() > now ? h.deadline : null;
  const length = h.when.split(" · ").at(1);
  return (
    <>
      <div className="rounded-b-[10px] p-5 pt-4 text-ink" style={{ background: h.color }}>
        <div className="flex items-start justify-between gap-4">
          <p className="narrow text-sm font-bold tracking-[0.08em] uppercase">
            {d.weekdays} · {d.month}
          </p>
          <p className="narrow text-sm font-bold tracking-[0.08em] uppercase">
            {d.daysAway === 0 ? "This weekend" : `${d.daysAway} day${d.daysAway === 1 ? "" : "s"} away`}
          </p>
        </div>
        <p className="narrow mt-1 text-[5.5rem] leading-[0.85] font-extrabold tracking-[-0.04em]" aria-hidden>
          {d.days}
        </p>
        <h3 className="mt-3 text-[2rem] lowercase">{h.name}</h3>
        <p className="mt-1.5 font-semibold">
          {h.host}
          {length && ` · ${length}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={h.url}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1f3a6e]"
          >
            {h.cta} ↗
          </a>
          {h.discord && (
            <a
              href={h.discord}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold shadow-[inset_0_0_0_2px_var(--color-ink)] hover:bg-ink/10"
            >
              Their Discord ↗
            </a>
          )}
        </div>
      </div>

      {/* The drive, drawn as a road from campus. */}
      <div className="mt-4 flex items-center gap-2 text-sm font-bold">
        <span>HFC</span>
        <span className="size-2 shrink-0 rounded-full bg-ink" />
        <span className="h-0 min-w-3 flex-1 border-t-2 border-dashed border-line" />
        <span className="narrow rounded-full px-2.5 py-0.5 text-ink" style={{ background: h.color }}>
          about {h.drive} drive
        </span>
        <span className="h-0 min-w-3 flex-1 border-t-2 border-dashed border-line" />
        <span className="size-2 shrink-0 rounded-full bg-ink" />
        <span className="text-right">{h.city}</span>
      </div>

      {due && (
        <p className="mt-4 flex items-baseline gap-2 text-[0.95rem] font-semibold">
          <span className="chip bg-signal text-white">Deadline</span>
          {due.label}
        </p>
      )}
      <p className="mt-4 leading-relaxed">{h.blurb}</p>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-line text-[0.95rem] shadow-[0_0_0_1px_var(--color-line)]">
        {[...h.facts, ["Where", h.place] as [string, string]].map(([k, v]) => (
          <div key={k} className="bg-white px-3 py-2 last:odd:col-span-2">
            <dt className="text-sm text-dim">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <Interest event={h.id} />
      </div>
    </>
  );
}

/** What a first hackathon is like: the weekend, what to pack, and tips. */
function HowItWorks() {
  const win = PAST.find((p) => p.result);
  return (
    <>
      <div className="rounded-b-[10px] bg-meadow p-5 pt-4 text-ink">
        <p className="narrow text-sm font-bold tracking-[0.08em] uppercase">Usually free · beginners welcome</p>
        <h3 className="mt-2 text-[2.5rem] lowercase">how a hackathon works</h3>
        <p className="mt-1.5 font-semibold">
          Usually a weekend of building something with a small team: an app, a game, hardware, an AI tool. Most college hackathons are free
          and feed you, and most give prizes at the end.
        </p>
      </div>

      <h3 className="mt-6 text-sm font-bold text-dim">The weekend</h3>
      <ol className="mt-2">
        {WEEKEND.map((step, i) => (
          <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
            {/* The line that strings the steps together. */}
            {i < WEEKEND.length - 1 && <span className="absolute top-7 bottom-0 left-[0.8rem] w-0.5 bg-line" aria-hidden />}
            <span className="narrow relative grid size-[1.65rem] shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="leading-snug font-extrabold">{step.title}</p>
              <p className="mt-0.5 text-[0.95rem] leading-snug text-dim">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h3 className="mt-6 text-sm font-bold text-dim">Pack</h3>
      <ul className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-line text-[0.95rem] shadow-[0_0_0_1px_var(--color-line)]">
        {PACK.map(([thing, why]) => (
          <li key={thing} className="bg-white px-3 py-2">
            <span className="block font-semibold">{thing}</span>
            <span className="text-sm text-dim">{why}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm font-bold text-dim">Tips</h3>
      <ul className="mt-2 divide-y divide-line">
        {TIPS.map((t) => (
          <li key={t.title} className="py-2.5">
            <p className="font-bold">{t.title}</p>
            <p className="mt-0.5 text-[0.95rem] leading-snug text-dim">{t.body}</p>
          </li>
        ))}
      </ul>

      {win?.result && (
        <p className="mt-4 flex gap-3 rounded-[10px] bg-gold/30 p-3 text-[0.95rem]">
          <svg viewBox="0 0 24 24" {...G} className="mt-0.5 size-5 shrink-0 text-[#a16207]" aria-hidden>
            <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
            <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
          </svg>
          <span>
            <span className="font-bold">From our club:</span> {win.result.who}, took {win.result.rank} place in the {win.result.of} at{" "}
            {win.name} this fall.
          </span>
        </p>
      )}
    </>
  );
}

/* ---------- learn: where to learn to code, and how to get hired ---------- */

const PRICE_CHIP: Record<Price, string> = {
  Free: "bg-[#dff5e3] text-[#14532d]",
  "Free tier": "bg-[#e3edff] text-[#0b4fa3]",
  Paid: "bg-[#fdebd3] text-[#9a3412]",
  "Free for students": "bg-[#efe6ff] text-[#5b21b6]",
};

function Learn() {
  const [stage, setStage] = useState<Stage["id"]>("start");
  return (
    <div>
      <p className="text-lg leading-relaxed">
        Where to learn to code, and what helps you land the job, in the order you’d use them. Most are free.
      </p>
      <Tabs.Root value={stage} onValueChange={(v) => setStage(v as Stage["id"])} className="mt-4">
        <Tabs.List className="relative grid grid-cols-4 gap-1 rounded-[10px] bg-mist p-1" aria-label="Where you are">
          {STAGES.map((s, i) => (
            <Tabs.Tab
              key={s.id}
              value={s.id}
              className="press relative z-10 flex h-12 flex-col items-center justify-center rounded-[8px] px-1 text-center leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[#1f63d6] data-[active]:text-ink"
            >
              <span className="text-[0.7rem] font-bold text-dim">{i + 1}</span>
              <span className="text-sm font-semibold">{s.title}</span>
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="learn-indicator absolute top-1 left-0 z-0 h-12 rounded-[8px] bg-white shadow-[0_1px_3px_rgb(6_24_56/0.18)]" />
        </Tabs.List>
        {STAGES.map((s) => (
          <Tabs.Panel key={s.id} value={s.id} className="learn-panel outline-none">
            <p className="mt-4 text-[0.95rem] text-dim">{s.goal}</p>
            <ul className="mt-3 space-y-2">
              {[...s.items]
                .sort((a, b) => Number(!!b.pick) - Number(!!a.pick))
                .map((r) => (
                  <li key={r.name}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start gap-3 rounded-[10px] p-3 shadow-[0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-[0_0_0_1px_#1f63d6,0_6px_16px_-10px_rgb(6_24_56/0.5)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-bold group-hover:underline">{r.name}</span>
                          <span className={`chip ${PRICE_CHIP[r.price]}`}>{r.price}</span>
                          {r.pick && <span className="chip bg-gold text-ink">Top pick</span>}
                        </span>
                        <span className="mt-0.5 block text-[0.95rem] leading-snug text-dim">{r.blurb}</span>
                      </span>
                      <span className="mt-0.5 text-dim group-hover:text-[#1f63d6]" aria-hidden>
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
            {s.id === "hired" && <NextHackathon />}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <p className="mt-5 border-t border-line pt-4 text-sm text-dim">
        Stuck on a lesson? Bring it to a meeting ({CLUB.day}, {CLUB.time}). Officers help with any course, in any language.
      </p>
    </div>
  );
}

/** A pointer from Learn to Code's "Get hired" stage to the Hackathons window. */
function NextHackathon() {
  const now = useNow();
  const next = now === null ? undefined : upcoming(now).at(0);
  return (
    <p className="mt-3 text-sm">
      {next ? `Next hackathon nearby: ${next.name}, ${shortWhen(next)}. ` : ""}
      <Link to="/hackathons" className="link">
        See hackathons near campus
      </Link>
      .
    </p>
  );
}

/** One anonymous heart per browser, so officers can see how many members want to go. */
function Interest({ event }: { event: string }) {
  const [voter, setVoter] = useState<string | null>(null);
  useEffect(() => {
    let id = localStorage.getItem("pc.voter");
    // randomUUID only exists on secure pages (HTTPS or localhost); a dev server opened by IP gets random hex instead.
    if (!id) {
      id = isSecureContext
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("pc.voter", id);
    }
    setVoter(id);
  }, []);
  const data = useQuery(api.interest.get, voter ? { event, voter } : "skip");
  const toggle = useMutation(api.interest.toggle).withOptimisticUpdate((store, args) => {
    const cur = store.getQuery(api.interest.get, args);
    if (cur) store.setQuery(api.interest.get, args, { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine });
  });
  const mine = !!data?.mine;
  const count = data?.count ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-mist p-3 pr-4">
      <button
        onClick={() => voter && void toggle({ event, voter })}
        disabled={!data}
        aria-pressed={mine}
        className={`press flex h-10 items-center gap-2 rounded-full px-4 font-semibold transition-colors ${mine ? "bg-[#e5484d] text-white" : "bg-white text-ink shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_#e5484d]"}`}
      >
        <svg key={String(mine)} viewBox="0 0 24 24" className={`size-5 ${mine ? "heart-pop" : ""}`} aria-hidden>
          <path
            d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
            fill={mine ? "currentColor" : "none"}
            stroke={mine ? "none" : "#e5484d"}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {mine ? "You’re interested" : "I’m interested"}
      </button>
      <p className="text-sm text-dim" aria-live="polite">
        {data ? (count === 1 ? "1 member interested" : `${count} members interested`) : "\u00a0"}
      </p>
    </div>
  );
}

export const APPS: App[] = [
  {
    id: "about",
    path: "/about",
    title: "welcome.txt",
    label: "Welcome",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <path d="M6 3h8l4 4v14H6Z" />
        <path d="M14 3v4h4M9 12h6M9 16h4" />
      </svg>
    ),
    at: { left: 12, top: 8 },
    width: "30rem",
    Content: About,
  },
  {
    id: "meetings",
    path: "/meetings",
    title: "Meetings",
    label: "Meetings",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </svg>
    ),
    at: { left: 50, top: 14 },
    width: "26rem",
    Content: Meetings,
  },
  {
    id: "world-cup",
    path: "/world-cup",
    title: "Hello, World Cup",
    label: "Hello, World Cup",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <path d="M6.5 4.5h11l2.5 14h-16Z" />
        <path d="M7.5 18.5l-1 1.5h11l-1-1.5M15 8.5v3.5H10M11.5 10.5L10 12l1.5 1.5" />
      </svg>
    ),
    at: { left: 30, top: 18 },
    width: "24rem",
    Content: WorldCup,
  },
  {
    id: "learn",
    path: "/learn-to-code",
    title: "Learn to code",
    label: "Learn to Code",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <path d="M3 6.5C5.5 5 8.5 5 12 7c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5Z" />
        <path d="M12 7v12.5M7.5 11L6 12.5 7.5 14M16.5 11l1.5 1.5-1.5 1.5" />
      </svg>
    ),
    at: { left: 38, top: 6 },
    width: "32rem",
    Content: Learn,
  },
  {
    id: "hackathons",
    path: "/hackathons",
    title: "Hackathons",
    label: "Hackathons",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <rect x="4" y="5" width="16" height="11" rx="1.5" />
        <path d="M2.5 19.5h19M12.8 7.8l-2.3 3.4h3l-2.3 3.4" />
      </svg>
    ),
    at: { left: 34, top: 8 },
    width: "28rem",
    Content: Hackathons,
  },
  {
    id: "officers",
    path: "/officers",
    title: "Officers",
    label: "Officers",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 15.2c2.8-.6 6 1.2 6 4.8" />
      </svg>
    ),
    at: { left: 40, top: 22 },
    width: "24rem",
    Content: Officers,
  },
  {
    id: "join",
    path: "/how-to-join",
    title: "How to join",
    label: "How to join",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <circle cx="10" cy="8" r="3.5" />
        <path d="M3 20c0-3.9 3.1-7 7-7 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6" />
      </svg>
    ),
    at: { left: 22, top: 26 },
    width: "26rem",
    Content: Join,
  },
  {
    id: "discord",
    path: "/club-discord",
    title: "Discord",
    label: "Discord",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5Z" />
        <path d="M16.5 9.5H20a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 20 18h-1v2.5L16 18h-3.5a1.5 1.5 0 0 1-1.5-1.5v-2" />
        <path d="M7 10h.01M9.5 10h.01M12 10h.01" />
      </svg>
    ),
    at: { left: 48, top: 20 },
    width: "28rem",
    Content: Discord,
  },
  {
    id: "contribute",
    path: "/contribute",
    title: "CONTRIBUTING.md",
    label: "Contribute",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <circle cx="6.5" cy="5.5" r="2" />
        <circle cx="6.5" cy="18.5" r="2" />
        <circle cx="17.5" cy="8.5" r="2" />
        <path d="M6.5 7.5v9M17.5 10.5c0 4-11 2.5-11 6" />
      </svg>
    ),
    at: { left: 38, top: 16 },
    width: "30rem",
    Content: Contribute,
  },
  {
    id: "site",
    path: "/site",
    title: "About this site",
    label: "About this site",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
    ),
    at: { left: 58, top: 30 },
    width: "26rem",
    Content: Site,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    title: "Officer dashboard",
    label: "Dashboard",
    glyph: (
      <svg viewBox="0 0 24 24" {...G}>
        <rect x="3.5" y="4" width="7" height="9" rx="1.5" />
        <rect x="13.5" y="4" width="7" height="5" rx="1.5" />
        <rect x="13.5" y="12" width="7" height="8" rx="1.5" />
        <rect x="3.5" y="16" width="7" height="4" rx="1.5" />
      </svg>
    ),
    at: { left: 26, top: 6 },
    width: "36rem",
    Content: Dashboard,
    officer: true,
  },
];

export const appFor = (path: string) => APPS.find((a) => a.path === path) ?? null;

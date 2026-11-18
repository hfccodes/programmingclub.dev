// Discord verification (/discord): sign in with HawkMail, pick what to get pinged about, and connect Discord.
// The club's bot then adds them to the server with their roles (convex/discord.ts).
import { SignInButton, SignOutButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import type { ReactNode } from "react";
import { ClubLogo } from "#/components/site";
import { Chips, Question } from "#/components/survey";
import { Loading } from "#/components/ui";
import { DISCORD_INTERESTS, VERIFY_ERRORS } from "#/lib/discord";
import type { VerifyError } from "#/lib/discord";
import { CLUB, fmtDate } from "#/lib/season";
import { api } from "../../convex/_generated/api";

export function DiscordVerify({ done, error }: { done?: string; error?: VerifyError }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.discord.mine, isAuthenticated ? {} : "skip");
  const start = useMutation(api.discord.start);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>(error ? VERIFY_ERRORS[error] : "");

  if (isLoading || (isAuthenticated && mine === undefined))
    return (
      <Shell>
        <Loading />
      </Shell>
    );

  const interests = picked ?? mine?.interests ?? [];
  const server = mine?.guild ? `https://discord.com/channels/${mine.guild}` : "https://discord.com/app";

  if (done)
    return (
      <Shell>
        <div className="card p-8">
          <p className="text-sm font-bold text-[#0b4fa3]">Verified</p>
          <h2 className="mt-2 text-4xl lowercase">you’re in, @{done}!</h2>
          <p className="mt-4 text-lg text-dim">Your roles are set. Open Discord and the whole server is there.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={server} className="btn btn-primary">
              Open Discord
            </a>
            <Link to="/discord" search={{}} className="btn">
              Change my pings
            </Link>
          </div>
        </div>
      </Shell>
    );

  async function connect() {
    setBusy(true);
    setProblem("");
    try {
      window.location.assign(await start({ interests }));
    } catch (e) {
      setProblem(e instanceof ConvexError ? String(e.data) : "That didn’t go through. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Shell>
      {problem && (
        <p role="alert" className="mb-8 rounded-[6px] bg-signal/10 px-4 py-3 font-semibold text-signal">
          {problem}
        </p>
      )}

      <div className="space-y-12 lg:space-y-8">
        <Question n={1} title="Sign in with your HawkMail">
          {!mine ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SignInButton mode="modal" withSignUp forceRedirectUrl="/discord">
                <button className="btn btn-primary">Sign in with HawkMail</button>
              </SignInButton>
              <p className="text-sm text-dim">We’ll email you a code. Faculty and staff can use their @hfcc.edu email.</p>
            </div>
          ) : !mine.eligible ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1">
                You’re signed in as <strong className="[overflow-wrap:anywhere]">{mine.email}</strong>, which isn’t a HawkMail.
              </p>
              <SignOutButton redirectUrl="/discord">
                <button className="btn btn-primary">Switch to HawkMail</button>
              </SignOutButton>
            </div>
          ) : (
            <p>
              <span aria-hidden>✓ </span>Signed in as <strong className="[overflow-wrap:anywhere]">{mine.email}</strong>.{" "}
              <SignOutButton redirectUrl="/discord">
                <button className="link text-sm">Not you?</button>
              </SignOutButton>
            </p>
          )}
        </Question>

        <Question n={2} title="What do you want pings for?" hint="Optional. Officers ping these roles about events and posts on the topic.">
          <Chips options={DISCORD_INTERESTS} picked={interests} onChange={setPicked} />
        </Question>

        <Question n={3} title="Connect Discord">
          {mine?.link && (
            <p className="mb-3 text-dim">
              Verified as <strong className="text-ink">@{mine.link.username}</strong> on {fmtDate(new Date(mine.link.verifiedAt))}. Connect
              again to update your pings or switch accounts.
            </p>
          )}
          <button className="btn btn-primary text-lg max-sm:w-full" disabled={!mine?.eligible || busy} onClick={() => void connect()}>
            {busy ? "Opening Discord…" : mine?.link ? "Update my roles" : "Connect Discord"}
          </button>
          <p className="mt-3 max-w-[56ch] text-sm text-dim">
            Discord asks to let the club see your username and add you to the server. We keep your HawkMail and Discord ID to link them,
            nothing else. See the{" "}
            <Link to="/privacy" className="link">
              privacy policy
            </Link>
            .
          </p>
        </Question>
      </div>
    </Shell>
  );
}

/** What's inside, drawn like Discord's channel list: shown beside the steps on wide screens. */
const PREVIEW = [
  { name: "Welcome", channels: ["welcome", "rules", "announcements"] },
  { name: "Club", channels: ["general", "introductions", "meeting-chat", "opportunities"] },
  { name: "Code", channels: ["help", "projects", "ai", "gamedev", "cybersecurity", "challenges"] },
];

function ServerPreview() {
  return (
    <div className="rounded-[12px] bg-[#0c2148] p-5 text-[#f3f6fc] shadow-[0_18px_40px_-24px_rgb(12_33_72/0.7)]">
      <p className="flex items-center gap-2.5 border-b border-white/10 pb-3.5 font-bold">
        <ClubLogo className="size-7" />
        {CLUB.name} · HFC
      </p>
      <dl className="mt-3.5 space-y-3">
        {PREVIEW.map((g) => (
          <div key={g.name} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3">
            <dt className="text-[0.7rem] font-bold tracking-[0.08em] text-white/50 uppercase">{g.name}</dt>
            <dd className="flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[0.85rem] text-white/85">
              {g.channels.map((c) => (
                <span key={c}>
                  <span className="text-white/40">#</span>
                  {c}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-white/10 pt-3.5 text-sm text-white/60">Plus voice rooms for hanging out and studying together.</p>
    </div>
  );
}

/** The page: the pitch on the left (and on top on phones), the steps or result on the right. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-[min(1120px,100%-2.5rem)] pt-8 pb-16">
      <Link to="/" className="inline-flex items-center gap-3 text-sm font-semibold text-dim hover:text-ink">
        <ClubLogo className="size-8" />
        {CLUB.name} at {CLUB.school}
      </Link>
      <div className="mt-10 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-start lg:gap-16">
        <header className="lg:sticky lg:top-10">
          <h1 className="text-[clamp(2.6rem,8vw,4.2rem)] leading-[0.92] lowercase">join the club discord</h1>
          <p className="mt-4 max-w-[52ch] text-lg text-dim">
            The server is for {CLUB.school} students, so we check your HawkMail first. It takes about 30 seconds, and you’re added to the
            server right after.
          </p>
          <div className="mt-8 max-lg:hidden">
            <ServerPreview />
          </div>
        </header>
        <div className="max-lg:mt-10">{children}</div>
      </div>
    </main>
  );
}

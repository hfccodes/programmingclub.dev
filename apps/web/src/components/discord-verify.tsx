// Discord verification (/discord/verify): sign in with HawkMail, pick what to get pinged about, and connect Discord.
// The club's bot then adds them to the server with their roles (convex/discord.ts).
import { SignInButton, SignOutButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Chips, Page, Question } from "#/components/survey";
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
      <Page>
        <Loading />
      </Page>
    );

  const interests = picked ?? mine?.interests ?? [];
  const server = mine?.guild ? `https://discord.com/channels/${mine.guild}` : "https://discord.com/app";

  if (done)
    return (
      <Page>
        <div className="card mt-10 p-8">
          <p className="text-sm font-bold text-[#0b4fa3]">Verified</p>
          <h2 className="mt-2 text-4xl lowercase">you’re in, @{done}!</h2>
          <p className="mt-4 text-lg text-dim">Your roles are set. Open Discord and the whole server is there.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={server} className="btn btn-primary">
              Open Discord
            </a>
            <Link to="/discord/verify" search={{}} className="btn">
              Change my pings
            </Link>
          </div>
        </div>
      </Page>
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
    <Page>
      <header className="mt-10">
        <h1 className="text-[clamp(2.6rem,8vw,4.2rem)] leading-[0.92] lowercase">join the club discord</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-dim">
          The server is for {CLUB.school} students, so we check your HawkMail first. It takes about 30 seconds, and you’re added to the
          server right after.
        </p>
      </header>

      {problem && (
        <p role="alert" className="mt-8 rounded-[6px] bg-signal/10 px-4 py-3 font-semibold text-signal">
          {problem}
        </p>
      )}

      <div className="mt-10 space-y-12">
        <Question n={1} title="Sign in with your HawkMail">
          {!mine ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SignInButton mode="modal" withSignUp forceRedirectUrl="/discord/verify">
                <button className="btn btn-primary">Sign in with HawkMail</button>
              </SignInButton>
              <p className="text-sm text-dim">We’ll email you a code. Faculty and staff can use their @hfcc.edu email.</p>
            </div>
          ) : !mine.eligible ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1">
                You’re signed in as <strong>{mine.email}</strong>, which isn’t a HawkMail.
              </p>
              <SignOutButton redirectUrl="/discord/verify">
                <button className="btn btn-primary">Switch to HawkMail</button>
              </SignOutButton>
            </div>
          ) : (
            <p>
              <span aria-hidden>✓ </span>Signed in as <strong>{mine.email}</strong>.{" "}
              <SignOutButton redirectUrl="/discord/verify">
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
    </Page>
  );
}

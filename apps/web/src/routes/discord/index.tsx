import { createFileRoute } from "@tanstack/react-router";
import { DiscordVerify } from "#/components/discord-verify";
import { VERIFY_ERRORS } from "#/lib/discord";
import type { VerifyError } from "#/lib/discord";
import { CLUB } from "#/lib/season";

// programmingclub.dev/discord: the link to share for joining the club Discord (in #verify, on flyers, in the desktop's
// Discord window). Discord sends members back here with
// ?done=<username> or ?error=<reason> (convex/discord.ts).
export const Route = createFileRoute("/discord/")({
  validateSearch: (s: Record<string, unknown>): { done?: string; error?: VerifyError } => ({
    done: typeof s.done === "string" ? s.done : undefined,
    error: typeof s.error === "string" && s.error in VERIFY_ERRORS ? (s.error as VerifyError) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Join the club Discord · ${CLUB.name}` },
      { name: "description", content: `Verify your HawkMail to join ${CLUB.name}’s Discord.` },
    ],
  }),
  component: function VerifyPage() {
    const { done, error } = Route.useSearch();
    return <DiscordVerify done={done} error={error} />;
  },
});

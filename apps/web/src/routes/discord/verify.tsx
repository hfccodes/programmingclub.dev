import { createFileRoute } from "@tanstack/react-router";
import { DiscordVerify } from "#/components/discord-verify";
import { VERIFY_ERRORS } from "#/lib/discord";
import type { VerifyError } from "#/lib/discord";
import { CLUB } from "#/lib/season";

// The link in the server's #verify channel and the desktop's Discord window. Discord sends members back here with
// ?done=<username> or ?error=<reason> (convex/discord.ts).
export const Route = createFileRoute("/discord/verify")({
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

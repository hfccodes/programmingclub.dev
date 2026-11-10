import { createFileRoute } from "@tanstack/react-router";
import { CLUB } from "#/lib/season";

// The desktop (routes/_desktop.tsx) opens the matching window; this route only sets the address and title.
export const Route = createFileRoute("/_desktop/builder-wars")({
  head: () => ({ meta: [{ title: `BuilderWars · ${CLUB.name} at ${CLUB.school}` }] }),
  component: () => null,
});

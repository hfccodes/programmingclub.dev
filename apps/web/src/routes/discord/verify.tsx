import { createFileRoute, redirect } from "@tanstack/react-router";

// The old address, still in the pinned #verify message: it's /discord now.
export const Route = createFileRoute("/discord/verify")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/discord", search, replace: true });
  },
});

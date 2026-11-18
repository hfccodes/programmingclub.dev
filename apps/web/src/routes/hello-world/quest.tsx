import { createFileRoute } from "@tanstack/react-router";
import { QuestGame } from "#/game/quest/QuestGame";

// Snow Quest, the season Final: a top-down adventure around a snowy town. Full window, no site chrome. Phaser loads in
// the browser only (QuestGame imports it inside an effect), so the server renders just the title screen.
export const Route = createFileRoute("/hello-world/quest")({
  head: () => ({ meta: [{ title: "Snow Quest · hello, world cup" }] }),
  component: QuestGame,
});

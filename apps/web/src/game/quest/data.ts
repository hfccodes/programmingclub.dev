// The one place the game gets its content and progress from, so the game never imports the backend directly.
export { ITEMS, LEVELS, levelFor, WAIT_MS } from "#/lib/quest";
export type { QuestItem } from "#/lib/quest";
export { useQuest } from "#/lib/quest-client";
export type { QuestState } from "#/lib/quest-client";

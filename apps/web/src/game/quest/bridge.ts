// The line between the Phaser world and the React overlay. React sets what the player has (claimed, level) and pauses
// the world while a panel is open; the world reports what the player walks up to.
import type { Spot } from "./world";

export type NpcSpot = Extract<Spot, { kind: "npc" }>;

export type Interact =
  { kind: "npc"; npc: NpcSpot } | { kind: "poke"; lines: string[] } | { kind: "terminal"; key: string } | { kind: "secret"; key: string };

export interface WorldApi {
  /** Re-read claimed and level: terminals change, secrets vanish, exits unlock. */
  refresh: () => void;
  /** A level was reached: show off any exit in this room that just opened. */
  celebrate: (level: number) => void;
  /** Sparkles around the player. */
  burst: (color?: number) => void;
  setPaused: (p: boolean) => void;
  /** Switch the player's character (a PLAYERS row id); it's remembered. */
  setCharacter: (id: string) => void;
}

export class Bridge {
  claimed = new Set<string>();
  level = 1;
  paused = true;
  world?: WorldApi;
  onInteract: (i: Interact) => void = () => {};
  onRoom: (id: string) => void = () => {};
  onBlocked: (line: string) => void = () => {};
  onReady: () => void = () => {};
}

// The room graph from rooms.ts, plus small lookups the engine and overlay share.
import { ROOMS } from "./rooms";

export { CELL, ROOMS, ROOM_H, ROOM_W, START_ROOM } from "./rooms";
export type { Dir, Exit, Room, Spot } from "./rooms";
export const roomById = (id: string) => ROOMS.find((r) => r.id === id);

/** Rooms the player has walked into, in localStorage. */
export const VISITED_KEY = "quest:visited:v2";

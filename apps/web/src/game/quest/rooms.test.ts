import { describe, expect, test } from "bun:test";
import { ITEMS } from "../../lib/quest";
import { COLS, ROOMS, ROWS, START_ROOM } from "./rooms";
import type { Room } from "./rooms";

// Each check collects readable problems and expects none, so a failure says exactly what is wrong.

const byId = new Map(ROOMS.map((r) => [r.id, r]));
const key = (room: string, c: number, r: number) => `${room}:${c},${r}`;
const walkable = (room: Room, c: number, r: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && room.walk[r]?.[c] === ".";
/** People and terminals stand in the way; the player walks around them. */
const solid = (room: Room) =>
  new Set(room.spots.filter((s) => s.kind === "npc" || s.kind === "terminal").map((s) => `${s.at[0]},${s.at[1]}`));

/** Every cell reachable from the start, walking through exits (level locks ignored). */
function reachable() {
  const seen = new Set<string>();
  const start = byId.get(START_ROOM);
  if (!start?.start) return seen;
  const queue: [string, number, number][] = [[start.id, start.start[0], start.start[1]]];
  seen.add(key(start.id, start.start[0], start.start[1]));
  const visit = (rid: string, c: number, r: number) => {
    if (seen.has(key(rid, c, r))) return;
    seen.add(key(rid, c, r));
    queue.push([rid, c, r]);
  };
  while (queue.length) {
    const [id, c, r] = queue.shift()!;
    const room = byId.get(id)!;
    const block = solid(room);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc,
        nr = r + dr;
      if (walkable(room, nc, nr) && !block.has(`${nc},${nr}`)) visit(id, nc, nr);
    }
    for (const exit of room.exits)
      if (exit.cells.some(([ec, er]) => ec === c && er === r) && byId.has(exit.to)) visit(exit.to, exit.arrive[0], exit.arrive[1]);
  }
  return seen;
}

describe("rooms", () => {
  const seen = reachable();

  test("start room exists and its start cell is walkable", () => {
    const start = byId.get(START_ROOM);
    expect(!!start?.start && walkable(start, start.start[0], start.start[1])).toBe(true);
  });

  test("ids are unique", () => expect(byId.size).toBe(ROOMS.length));

  test("every grid is 27 rows of 48 '.' or '#'", () => {
    const problems = ROOMS.flatMap((room) =>
      room.walk.length !== ROWS
        ? [`${room.id}: ${room.walk.length} rows`]
        : room.walk.flatMap((row, r) => (/^[.#]{48}$/.test(row) ? [] : [`${room.id} row ${r}: ${JSON.stringify(row)}`])),
    );
    expect(problems).toEqual([]);
  });

  test("exits lead somewhere real, arrive on walkable ground off any exit, and are reachable", () => {
    const problems: string[] = [];
    for (const room of ROOMS)
      for (const exit of room.exits) {
        const name = `${room.id} -> ${exit.to}`;
        const dest = byId.get(exit.to);
        if (!dest) {
          problems.push(`${name}: no such room`);
          continue;
        }
        const [ac, ar] = exit.arrive;
        if (!walkable(dest, ac, ar)) problems.push(`${name}: arrive ${ac},${ar} is blocked`);
        if (dest.exits.some((e) => e.cells.some(([c, r]) => c === ac && r === ar))) problems.push(`${name}: arrives on an exit`);
        if (!dest.exits.some((e) => e.to === room.id)) problems.push(`${name}: no way back`);
        for (const [c, r] of exit.cells) if (!walkable(room, c, r)) problems.push(`${name}: exit cell ${c},${r} is blocked`);
        if (exit.cells.length < (exit.hidden ? 1 : 3)) problems.push(`${name}: only ${exit.cells.length} cells`);
        if (!exit.cells.some(([c, r]) => seen.has(key(room.id, c, r)))) problems.push(`${name}: unreachable`);
      }
    expect(problems).toEqual([]);
  });

  test("every room is reachable and every spot can be reached from a neighbouring cell", () => {
    const problems: string[] = [];
    for (const room of ROOMS) {
      if (![...seen].some((k) => k.startsWith(`${room.id}:`))) problems.push(`${room.id}: unreachable room`);
      for (const spot of room.spots) {
        const [c, r] = spot.at;
        const ok = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dc, dr]) => seen.has(key(room.id, c + dc, r + dr)));
        if (!ok) problems.push(`${room.id}: ${spot.kind} at ${c},${r} unreachable`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every item is placed exactly once, as the right kind, in a room of its zone", () => {
    const placed = ROOMS.flatMap((room) =>
      room.spots.flatMap((s) => (s.kind === "terminal" || s.kind === "secret" ? [{ item: s.item, room, kind: s.kind }] : [])),
    );
    const problems: string[] = [];
    for (const item of ITEMS) {
      const here = placed.filter((p) => p.item === item.key);
      if (here.length !== 1) problems.push(`${item.key}: placed ${here.length} times`);
      for (const p of here) {
        if (p.room.zone !== item.zone) problems.push(`${item.key}: zone ${item.zone} item in zone ${p.room.zone} room ${p.room.id}`);
        if (p.kind !== (item.kind === "puzzle" ? "terminal" : "secret")) problems.push(`${item.key}: a ${item.kind} placed as a ${p.kind}`);
      }
    }
    const keys = new Set(ITEMS.map((i) => i.key));
    for (const p of placed) if (!keys.has(p.item)) problems.push(`${p.room.id}: unknown item ${p.item}`);
    for (const room of ROOMS)
      for (const s of room.spots)
        if (s.kind === "npc" && s.after && !keys.has(s.after.item)) problems.push(`${room.id}: ${s.name} after unknown ${s.after.item}`);
    expect(problems).toEqual([]);
  });
});

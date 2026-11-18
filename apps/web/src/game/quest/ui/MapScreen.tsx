// The town map (Tab): a postcard of each room, cut from its own painting, laid out like the town. Paths are drawn
// only in the gaps between postcards, so no line ever crosses a name. Each card shows one state: you are here,
// visited, not visited yet, or locked (with the level that opens it), plus what's left to do there.
import { ITEMS } from "../data";
import { ROOMS } from "../world";
import type { Room } from "../world";
import { Key } from "./bits";

/** Where each room sits: [row, column] on a 5 x 3 board (column 0 is the hidden grove's, 1 the main road, 2 the side). */
const PLACE: Record<string, [number, number]> = {
  tower: [0, 1],
  hill: [1, 1],
  woods: [2, 1],
  clearing: [2, 2],
  rink: [3, 1],
  boathouse: [3, 2],
  grove: [4, 0],
  square: [4, 1],
  market: [4, 2],
};

// Grid tracks: a zone label column, then tile / gap / tile / gap / tile; rows alternate tile and gap.
// Tracks: tile / gap / tile (/ gap / tile when the grove's column is shown); rows alternate tile and gap.
let firstCol = 1;
const col = (c: number) => 1 + (c - firstCol) * 2;
const row = (r: number) => 1 + r * 2;

export function MapScreen({
  current,
  visited,
  level,
  claimed,
  onClose,
  onChangeCharacter,
}: {
  current: string;
  visited: string[];
  level: number;
  claimed: string[];
  onClose: () => void;
  onChangeCharacter?: () => void;
}) {
  const has = (k: string) => claimed.includes(k);
  const shown = (r: Room) => r.id in PLACE && (r.id !== "grove" || visited.includes("grove") || current === "grove");
  const rooms = ROOMS.filter(shown);
  const ids = new Set(rooms.map((r) => r.id));
  firstCol = ids.has("grove") ? 0 : 1;

  // Paths between neighbours, in the gap cell between them.
  const paths: { key: string; r: number; c: number; dir: "h" | "v"; locked: boolean }[] = [];
  for (const r of rooms)
    for (const e of r.exits) {
      if (!ids.has(e.to) || r.id > e.to) continue;
      const [ra, ca] = PLACE[r.id];
      const [rb, cb] = PLACE[e.to];
      const back = ROOMS.find((x) => x.id === e.to)?.exits.find((x) => x.to === r.id);
      const locked = Math.max(e.needsLevel ?? 0, back?.needsLevel ?? 0) > level;
      if (ra === rb && Math.abs(ca - cb) === 1)
        paths.push({ key: r.id + e.to, r: row(ra), c: col(Math.min(ca, cb)) + 1, dir: "h", locked });
      else if (ca === cb && Math.abs(ra - rb) === 1)
        paths.push({ key: r.id + e.to, r: row(Math.min(ra, rb)) + 1, c: col(ca), dir: "v", locked });
    }

  return (
    <div className="qx-mapscreen" onClick={onClose} data-testid="quest-bigmap">
      <div className="qx-mapcard" onClick={(e) => e.stopPropagation()}>
        <div className="qx-map-top">
          <p className="qx-display qx-map-title">Pine Street</p>
          <p className="qx-map-legend">
            <span className="qx-badge todo">1 terminal</span> to fix · <span className="qx-lockglyph" aria-hidden /> locked · <Key>Tab</Key>{" "}
            close
          </p>
          {onChangeCharacter && (
            <button className="qx-quiet" onClick={onChangeCharacter}>
              Change character
            </button>
          )}
        </div>
        <div
          className="qx-map-board"
          style={{
            gridTemplateColumns:
              firstCol === 0 ? "var(--qx-tile) 2.6cqw var(--qx-tile) 2.6cqw var(--qx-tile)" : "var(--qx-tile) 2.6cqw var(--qx-tile)",
          }}
        >
          {paths.map((p) => (
            <i key={p.key} className={`qx-path ${p.dir} ${p.locked ? "locked" : ""}`} style={{ gridRow: p.r, gridColumn: p.c }} />
          ))}
          {rooms.map((r) => {
            const [rr, cc] = PLACE[r.id];
            const here = r.id === current;
            const seen = visited.includes(r.id) || here;
            const locked = r.zone > level;
            const todo = locked
              ? 0
              : r.spots.filter((s) => s.kind === "terminal" && !has(s.item) && (ITEMS.find((i) => i.key === s.item)?.zone ?? 9) <= level)
                  .length;
            const secrets = r.spots.filter((s) => s.kind === "secret" && has(s.item)).length;
            const img = r.id === "rink" && level >= 3 ? "/quest/rooms/rink-open.jpg" : r.image;
            return (
              <div
                key={r.id}
                className={`qx-tile ${here ? "here" : ""} ${locked ? "locked" : seen ? "seen" : "new"}`}
                style={{ gridRow: row(rr), gridColumn: col(cc) }}
              >
                <div className="qx-tile-pic">
                  <img src={img} alt="" loading="lazy" />
                  {locked && (
                    <span className="qx-tile-lock">
                      <span className="qx-lockglyph" aria-hidden /> Level {r.zone}
                    </span>
                  )}
                  {here && <span className="qx-tile-here">You are here</span>}
                  <span className="qx-tile-badges">
                    {todo > 0 && <span className="qx-badge todo">{todo === 1 ? "1 terminal" : `${todo} terminals`}</span>}
                    {secrets > 0 && <span className="qx-badge star">★ secret found</span>}
                  </span>
                </div>
                <p className="qx-tile-name">
                  <span className="qx-tile-zone">Zone {r.zone}</span>
                  {r.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

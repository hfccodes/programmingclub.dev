// The in-game HUD, laid over the 1536x864 game box (not the window), so it scales with the painting and never floats
// in the letterbox bars. Everything that stays on screen lives in the top band (rooms keep their terminals, people and
// side exits in the lower two thirds): who you are and what's next on the left, the room map and Cup points on the
// right. The room's name shows once on arrival, then only beside the map. Toasts have one home under the top band.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ITEMS, LEVELS } from "../data";
import type { QuestState } from "../data";
import { ROOMS, roomById } from "../world";
import { Key, zoneName } from "./bits";
import { MapScreen } from "./MapScreen";

const FINAL = ITEMS.find((i) => i.zone === 4 && i.kind === "puzzle")?.key;

export interface Toast {
  id: number;
  text: ReactNode;
  tone?: "good" | "bad";
}

export function Hud({
  state,
  place,
  muted,
  onMute,
  room,
  visited,
  paused,
  onChangeCharacter,
  onMap,
}: {
  state: QuestState;
  place: string;
  muted: boolean;
  onMute: () => void;
  room: string;
  visited: string[];
  paused: boolean;
  /** Opens the character picker. */
  onChangeCharacter?: () => void;
  /** Told when the full map opens or closes, so the world can pause. */
  onMap?: (open: boolean) => void;
}) {
  const cur = LEVELS.filter((l) => l.level <= state.level).at(-1)!;
  const next = LEVELS.find((l) => l.level === state.level + 1);
  const pct = next ? Math.min(100, ((state.xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100;
  const goal = objective(state, room);
  const rank = state.board.findIndex((b) => b.me);

  // The full map: Tab toggles it (only while walking around), hovering the small map peeks at it.
  const [mapOpen, setMapOpen] = useState(false);
  // The world stands still while the map is up.
  useEffect(() => onMap?.(mapOpen && !paused), [mapOpen, paused, onMap]);
  useEffect(() => {
    if (paused) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setMapOpen((o) => !o);
      } else if (e.key === "Escape") setMapOpen(false);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [paused]);

  // The objective is bright when it changes, then settles back.
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 6000);
    return () => clearTimeout(t);
  }, [goal]);

  return (
    <div className="qx qx-stage" aria-label="Game status">
      <div className="qx-hud-left">
        <div className="qx-hud-chip qx-hud-me">
          <p className="qx-hud-name">
            <span className="qx-display">{state.name}</span>
            <span className={`qx-tag ${state.live ? "live" : ""}`}>{state.live ? "Live" : "Practice"}</span>
          </p>
          <div className="qx-hud-level">
            <span>
              Lv <b>{state.level}</b> · {cur.title}
            </span>
            <span className="qx-hud-xp" title={next ? `${state.xp} / ${next.xp} XP to level ${next.level}` : `${state.xp} XP`}>
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="qx-hud-xpnum">{next ? `${state.xp}/${next.xp} XP` : `${state.xp} XP`}</span>
          </div>
        </div>
        <p className={`qx-hud-chip qx-hud-goal ${fresh ? "fresh" : ""}`} data-testid="quest-goal">
          <b>Next:</b> {goal}
        </p>
      </div>

      <div className={`qx-hud-right ${mapOpen && !paused ? "map-open" : ""}`} hidden={mapOpen && !paused}>
        <button
          className="qx-where-btn"
          onClick={() => setMapOpen((o) => !o)}
          aria-label={`You're in ${place}. Open the map (Tab)`}
          title="Map (Tab)"
        >
          <MapIcon />
          <span className="qx-hud-where">
            <span>Zone {roomById(room)?.zone ?? 1}</span>
            <b>{place}</b>
          </span>
          <Key>Tab</Key>
        </button>
        <Points points={state.points} rank={state.live && rank >= 0 ? `#${rank + 1} of ${state.board.length}` : null} />
        <div className="qx-hud-icons">
          <button
            onClick={onMute}
            className="qx-icon-btn"
            aria-label={muted ? "Sound on" : "Mute"}
            title={muted ? "Sound off (M)" : "Sound on (M)"}
          >
            {muted ? <SoundOff /> : <SoundOn />}
          </button>
          {onChangeCharacter && (
            <button onClick={onChangeCharacter} className="qx-icon-btn" aria-label="Change character" title="Change character">
              <Person />
            </button>
          )}
        </div>
      </div>

      <Controls paused={paused} />

      {mapOpen && !paused && (
        <MapScreen
          current={room}
          visited={visited}
          level={state.level}
          claimed={state.claimed}
          onClose={() => setMapOpen(false)}
          onChangeCharacter={onChangeCharacter && (() => (setMapOpen(false), onChangeCharacter()))}
        />
      )}
    </div>
  );
}

/** Cup points: the number that matters on the night. It counts up when it changes. */
function Points({ points, rank }: { points: number; rank: string | null }) {
  const [shown, setShown] = useState(points);
  const [gain, setGain] = useState<{ n: number; id: number } | null>(null);
  const from = useRef(points);
  useEffect(() => {
    const start = from.current;
    from.current = points;
    if (points === start) return;
    if (points > start) setGain({ n: points - start, id: Math.random() });
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(Math.round(start + (points - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [points]);
  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setGain(null), 1600);
    return () => clearTimeout(t);
  }, [gain]);
  return (
    <div className={`qx-points ${gain ? "bump" : ""}`}>
      <span className="qx-points-label">Cup points</span>
      <b className="qx-display" data-testid="quest-points">
        {shown}
      </b>
      {rank && <span className="qx-points-rank">{rank}</span>}
      {gain && (
        <span key={gain.id} className="qx-points-gain">
          +{gain.n}
        </span>
      )}
    </div>
  );
}

/** How to play, until the player has walked and used something (or for the first minute); then a small "?". */
function Controls({ paused }: { paused: boolean }) {
  const [learned, setLearned] = useState({ moved: false, used: false, timeUp: false });
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLearned((l) => ({ ...l, timeUp: true })), 60_000);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
        setLearned((l) => (l.moved ? l : { ...l, moved: true }));
      if (k === "e") setLearned((l) => (l.used ? l : { ...l, used: true }));
      if (k === "?" || k === "h") setPeek((p) => !p);
    };
    window.addEventListener("keydown", down);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", down);
    };
  }, []);
  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(false), 8000);
    return () => clearTimeout(t);
  }, [peek]);
  const show = !paused && (peek || !(learned.timeUp || (learned.moved && learned.used)));
  return (
    <>
      <p className={`qx-controls ${show ? "" : "gone"}`} aria-hidden={!show}>
        <Key>WASD</Key> or <Key>arrows</Key> walk · <Key>E</Key> talk / use · <Key>M</Key> mute
      </p>
      {!paused && (
        <button
          className={`qx-icon-btn qx-help-q ${show ? "gone" : ""}`}
          onClick={() => setPeek(true)}
          aria-label="Show the controls"
          title="Controls (?)"
        >
          ?
        </button>
      )}
    </>
  );
}

/** The room's name as you walk in: zone eyebrow, room title, gone after two seconds. */
export function Arrival({ banner }: { banner: { room: string; id: number } | null }) {
  const room = banner ? roomById(banner.room) : undefined;
  if (!banner || !room) return null;
  const zone = ZONE_TITLES[room.zone] ?? zoneName(room.zone);
  return (
    <div className="qx qx-stage" aria-live="polite">
      <div key={banner.id} className="qx-arrival">
        <p className="qx-arrival-eyebrow">
          Zone {room.zone}
          {zone !== room.name ? ` · ${zone}` : ""}
        </p>
        <p className="qx-display qx-arrival-title">{room.name}</p>
      </div>
    </div>
  );
}

const ZONE_TITLES: Partial<Record<number, string>> = { 1: "Pine Street", 2: "The Frozen Rink", 3: "Lantern Woods", 4: "The Festival" };

/** Messages, in one place: centred under the top band, clear of the arrival title and the dialogue box. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="qx qx-stage">
      <div className="qx-toasts" role="status">
        {toasts.map((t) => (
          <p key={t.id} className={`qx-toast ${t.tone ?? ""}`}>
            {t.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The nearest sensible goal: a terminal in this room, else the room with the lowest-zone unsolved terminal you can
 * reach, else what opens next. Terminals are found through the rooms' spots, so the room named is where it really is. */
function objective(s: QuestState, here: string) {
  const has = (k: string) => s.claimed.includes(k);
  const open = (key: string) => {
    const it = ITEMS.find((i) => i.key === key);
    return !!it && it.kind === "puzzle" && it.zone <= s.level && !has(key);
  };
  const todo = (roomId: string) => roomById(roomId)?.spots.filter((p) => p.kind === "terminal" && open(p.item)) ?? [];
  const mine = todo(here);
  if (mine.length) return mine.length === 1 ? "the glowing terminal in this room." : `${mine.length} glowing terminals in this room.`;
  const rooms = ROOMS.filter((r) => r.zone <= s.level && todo(r.id).length).sort((a, b) => a.zone - b.zone);
  if (rooms.length) {
    const n = todo(rooms[0].id).length;
    return `${n === 1 ? "the glowing terminal" : `${n} glowing terminals`} in ${rooms[0].name}.`;
  }
  const next = LEVELS.find((l) => l.level === s.level + 1);
  if (next && s.level < 4) return `${next.xp - s.xp} more XP opens ${zoneName(s.level + 1)}. Find a secret: ask the townspeople.`;
  if (FINAL && !has(FINAL)) return "the big terminal at the festival.";
  const all = ITEMS.filter((i) => i.kind === "secret");
  const secretsLeft = all.filter((i) => i.zone <= s.level && !has(i.key)).length;
  return secretsLeft ? `find every secret (${all.filter((i) => has(i.key)).length}/${all.length}).` : "you did everything. Legend.";
}

const MapIcon = () => (
  <svg className="qx-map-icon" viewBox="0 0 20 20" aria-hidden>
    <path d="M2.5 4.5l5-2 5 2 5-2v13l-5 2-5-2-5 2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7.5 2.5v13M12.5 4.5v13" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const Person = () => (
  <svg viewBox="0 0 20 20" aria-hidden>
    <circle cx="10" cy="6.5" r="3.2" fill="currentColor" />
    <path d="M3.5 17.5c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" fill="currentColor" />
  </svg>
);
const SoundOn = () => (
  <svg viewBox="0 0 20 20" aria-hidden>
    <path d="M3 8v4h3l4 3.5v-11L6 8H3z" fill="currentColor" />
    <path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const SoundOff = () => (
  <svg viewBox="0 0 20 20" aria-hidden>
    <path d="M3 8v4h3l4 3.5v-11L6 8H3z" fill="currentColor" />
    <path d="M13 8l4 4m0-4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

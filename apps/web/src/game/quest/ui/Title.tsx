// The title screen and the character picker. A first-time player presses Enter and chooses who to play; a returning
// player's choice is remembered (localStorage), so Enter goes straight into the game. The picker also opens from the
// HUD later. Characters come from players.ts when it exists (a glob import, so a missing file never breaks the build),
// otherwise just the hero from heroes.png.
import { useEffect, useMemo, useState } from "react";
import type { QuestState } from "../data";
import { HEROES } from "../heroes";
import { unlock } from "../sound";
import { ART, Art, Key } from "./bits";

export const CHAR_KEY = "hwc.quest.char";

interface Roster {
  url: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: readonly { id: string; name: string }[];
}

const found = Object.values(import.meta.glob<{ PLAYERS?: Roster }>("../players.ts", { eager: true }))[0]?.PLAYERS;
const FALLBACK: Roster = { url: HEROES.url, frameWidth: 64, frameHeight: 96, columns: 12, rows: [{ id: "hero", name: "Robin" }] };
const ROSTER: Roster = found && found.rows.length ? found : FALLBACK;

export function readChar(): string | null {
  try {
    const id = localStorage.getItem(CHAR_KEY);
    return id && ROSTER.rows.some((r) => r.id === id) ? id : null;
  } catch {
    return null;
  }
}
function saveChar(id: string) {
  try {
    localStorage.setItem(CHAR_KEY, id);
  } catch {
    // Storage blocked: the choice lasts this visit.
  }
}

/** Whether a sheet image loads, checked once per url. */
function useLoads(url: string) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setOk(true);
    img.onerror = () => setOk(false);
    img.src = url;
  }, [url]);
  return ok;
}

export function Title({ state, onStart, onCharacter }: { state: QuestState; onStart: () => void; onCharacter: (id: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [waiting, setWaiting] = useState<{ seed: number; id: string } | null>(null);
  const inLobby = state.live && !state.started && !state.ended;
  const lobbyKey = `hwc.quest.lobby.${state.seed}`;
  const character = state.live && waiting?.seed === state.seed ? ROSTER.rows.find((r) => r.id === waiting.id) : undefined;
  const go = !!character && state.started && !state.ended;

  useEffect(() => {
    if (!inLobby) return;
    try {
      const id = sessionStorage.getItem(lobbyKey);
      if (id) setWaiting({ seed: state.seed, id });
    } catch {
      // A browser without storage can still wait until it reloads.
    }
  }, [inLobby, lobbyKey, state.seed]);

  useEffect(() => {
    if (!character || (!go && !state.ended)) return;
    const timer = setTimeout(
      () => {
        try {
          sessionStorage.removeItem(lobbyKey);
        } catch {
          // Storage can be blocked.
        }
        onStart();
      },
      go ? 1000 : 0,
    );
    return () => clearTimeout(timer);
  }, [character, go, lobbyKey, onStart, state.ended]);

  const finish = (id = readChar() ?? ROSTER.rows[0].id) => {
    if (!inLobby) {
      onStart();
      return;
    }
    unlock();
    setPicking(false);
    setWaiting({ seed: state.seed, id });
    try {
      sessionStorage.setItem(lobbyKey, id);
    } catch {
      // The choice still lasts this visit.
    }
  };
  const start = () => {
    if (!state.ready) return;
    const id = readChar();
    if (id) finish(id);
    else setPicking(true);
  };
  useEffect(() => {
    if (picking || character) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });
  return (
    <div className="qx qx-title" onClick={() => !picking && !character && start()}>
      <Art src={`${ART}/title.png`} alt="" className="qx-title-art" />
      <div className="qx-title-sky" aria-hidden>
        <i className="qx-stars a" />
        <i className="qx-stars b" />
        <i className="qx-aurora" />
        <i className="qx-moon" />
      </div>
      <i className="qx-title-snow a" aria-hidden />
      <i className="qx-title-snow b" aria-hidden />
      <div className="qx-title-ground" aria-hidden />
      {character ? (
        <div className="qx-title-lobby" data-testid="quest-lobby">
          <div className="qx-frame qx-title-lobby-panel">
            <h1 className="qx-display qx-title-lobby-name">You’re in, {state.name}.</h1>
            <figure className="qx-title-lobby-character">
              <Art src={`${ART}/player-${character.id}.png`} alt="" />
              <figcaption>{character.name}</figcaption>
            </figure>
            <p className={go ? "qx-display qx-title-go" : "qx-title-wait"} role="status">
              {go ? "Go!" : "Waiting for the host to start…"}
            </p>
            {state.board.length > 0 && (
              <ul className="qx-title-lobby-roster" aria-label="Players joined">
                {state.board.map((player, i) => (
                  <li key={i}>{player.name}</li>
                ))}
              </ul>
            )}
            <TitleControls />
          </div>
        </div>
      ) : picking ? (
        <CharacterPicker onChange={onCharacter} onDone={finish} first />
      ) : (
        <>
          <div className="qx-title-head">
            <p className="qx-eyebrow qx-title-eyebrow">
              {state.live ? "The Final · points count live" : "Practice mode · join tonight’s game to score"}
            </p>
            <h1 className="qx-display qx-logo qx-title-logo">Snow Quest</h1>
            <p className="qx-title-sub">
              Walk Pine Street, help the townspeople, and fix the town’s old terminals with code. Every solve and every secret scores.
            </p>
          </div>
          <div className="qx-title-foot">
            <button className="qx-btn gold big" disabled={!state.ready}>
              {state.ready ? (state.claimed.length ? `Continue as ${state.name} · press Enter` : `Press Enter to start`) : "Loading…"}
            </button>
            <TitleControls />
          </div>
        </>
      )}
    </div>
  );
}

function TitleControls() {
  return (
    <p className="qx-title-keys">
      <Key>WASD</Key> or <Key>arrows</Key> to walk · <Key>E</Key> to talk and use · <Key>M</Key> mutes
    </p>
  );
}

/**
 * Six character cards: arrows or a click to choose, Enter to play. `first` is the title-screen step; otherwise it's
 * the "Change character" overlay over the game, which Esc closes without a change.
 */
export function CharacterPicker({
  onChange,
  onDone,
  first,
}: {
  onChange: (id: string) => void;
  onDone: (id?: string) => void;
  first?: boolean;
}) {
  const sheet = useLoads(ROSTER.url);
  const [portraits, setPortraits] = useState<Record<string, boolean>>({});
  // A card shows if its portrait loaded or the sheet did; while either is still loading, it shows too.
  // The hero always has a card: heroes.png has them even before players.png exists.
  const cards = useMemo(
    () => ROSTER.rows.filter((r) => r.id === "hero" || portraits[r.id] !== false || sheet !== false),
    [portraits, sheet],
  );
  const [sel, setSel] = useState(() =>
    Math.max(
      0,
      ROSTER.rows.findIndex((r) => r.id === (readChar() ?? "hero")),
    ),
  );
  const at = Math.min(sel, Math.max(0, cards.length - 1));
  const choose = (i: number) => {
    setSel(i);
    const c = cards.at(i);
    if (!c) return;
    saveChar(c.id);
    onChange(c.id);
  };
  const confirm = () => {
    const c = cards.at(at);
    if (c) {
      saveChar(c.id);
      onChange(c.id);
    }
    onDone(c?.id);
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") choose((at - 1 + cards.length) % cards.length);
      else if (k === "ArrowRight" || k === "d" || k === "D") choose((at + 1) % cards.length);
      else if (k === "Enter" || k === " " || k === "e" || k === "E") confirm();
      else if (k === "Escape" && !first) onDone();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });
  return (
    <div className={first ? "qx qx-pick first" : "qx qx-pick"} onClick={(e) => e.stopPropagation()} data-testid="quest-picker">
      <p className="qx-eyebrow">{first ? "Before you set off" : "Change character"}</p>
      <h2 className="qx-display qx-pick-title">Choose your character</h2>
      <div className="qx-pick-row" role="listbox" aria-label="Characters">
        {cards.map((c, i) => (
          <button
            key={c.id}
            role="option"
            aria-selected={i === at}
            className={`qx-pick-card ${i === at ? "on" : ""}`}
            onClick={() => (i === at ? confirm() : choose(i))}
          >
            <span className="qx-pick-art" style={{ animationDelay: `${i * -0.37}s` }}>
              {portraits[c.id] !== false ? (
                <img src={`${ART}/player-${c.id}.png`} alt="" onError={() => setPortraits((p) => ({ ...p, [c.id]: false }))} />
              ) : (
                <Sprite
                  url={sheet === false ? HEROES.url : ROSTER.url}
                  row={
                    sheet === false
                      ? Math.max(0, HEROES.rows.indexOf(c.id as (typeof HEROES.rows)[number]))
                      : ROSTER.rows.findIndex((r) => r.id === c.id)
                  }
                />
              )}
            </span>
            <span className="qx-pick-name">{c.name}</span>
          </button>
        ))}
      </div>
      <button className="qx-btn gold big mt-6" onClick={confirm}>
        {first ? "Play" : "Done"} <Key gold>Enter</Key>
      </button>
      <p className="qx-pick-help">
        <Key>←</Key> <Key>→</Key> choose · <Key>Enter</Key> {first ? "start" : "done"}
        {!first && (
          <>
            {" "}
            · <Key>Esc</Key> close
          </>
        )}
      </p>
    </div>
  );
}

/** The standing, facing-down frame of a sheet row, drawn large. */
function Sprite({ url, row }: { url: string; row: number }) {
  const s = 2.6;
  const { frameWidth: w, frameHeight: h, columns } = ROSTER;
  return (
    <span
      className="qx-pick-sprite"
      style={{
        width: w * s,
        height: h * s,
        backgroundImage: `url(${url})`,
        backgroundSize: `${columns * w * s}px auto`,
        backgroundPosition: `${-1 * w * s}px ${-row * h * s}px`,
      }}
    />
  );
}

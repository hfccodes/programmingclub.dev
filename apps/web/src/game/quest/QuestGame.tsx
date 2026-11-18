// Snow Quest's React side: the title screen, HUD, dialogue, the terminal panel with its Python pad, level-ups, the
// ending, and the Phaser world underneath (loaded in an effect, so the server never touches Phaser).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bridge } from "./bridge";
import type { Interact } from "./bridge";
import { ITEMS, useQuest } from "./data";
import type { QuestItem } from "./data";
import { VISITED_KEY, roomById } from "./world";
import "./quest.css";
import { DialogBox } from "./ui/DialogBox";
import { Arrival, Hud, Toasts } from "./ui/Hud";
import type { Toast } from "./ui/Hud";
import { Ending, LevelUp, SecretFound } from "./ui/Moments";
import { Panel } from "./ui/Panel";
import { CharacterPicker, Title, readChar } from "./ui/Title";
import { isMuted, setMuted, sfx, unlock } from "./sound";

const FINAL = ITEMS.find((i) => i.zone === 4 && i.kind === "puzzle")?.key;

type Overlay = { kind: "level"; n: number } | { kind: "ending" } | { kind: "secret"; key: string; points: number; xp: number };
interface Dialog {
  name: string;
  portrait?: number;
  lines: string[];
  i: number;
}

export function QuestGame() {
  const { state, claim } = useQuest();
  const bridge = useMemo(() => new Bridge(), []);
  const host = useRef<HTMLDivElement>(null);
  const [enteredFor, setEnteredFor] = useState<number | "practice" | null>(null);
  const started = state.ready && (state.started || state.ended) && enteredFor === (state.live ? state.seed : "practice");
  // The character picker over the game (from the HUD), and the chosen sprite row in the world.
  const [picking, setPicking] = useState(false);
  const [mapUp, setMapUp] = useState(false);
  const setCharacter = useCallback(
    (id: string) => (bridge.world as { setCharacter?: (id: string) => void } | undefined)?.setCharacter?.(id),
    [bridge],
  );
  const [gameReady, setGameReady] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [visited, setVisited] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ room: string; id: number } | null>(null);
  const [dialog, setDialogState] = useState<Dialog | null>(null);
  /** When the last conversation closed, so the E that ended it doesn't reopen it. */
  const closedAt = useRef(0);
  const setDialog = useCallback((next: Dialog | null | ((d: Dialog | null) => Dialog | null)) => {
    setDialogState((d) => {
      const v = typeof next === "function" ? next(d) : next;
      if (d && !v) closedAt.current = Date.now();
      return v;
    });
  }, []);
  const [panel, setPanel] = useState<string | null>(null);
  const [queue, setQueue] = useState<Overlay[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMutedState] = useState(false);
  const prevLevel = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const enterWorld = useCallback(() => {
    unlock();
    const current = stateRef.current;
    setEnteredFor(current.live ? current.seed : "practice");
  }, []);

  useEffect(() => setMutedState(isMuted()), []);

  const toast = useCallback((text: ReactNode, tone?: Toast["tone"]) => {
    const id = Math.random();
    // The same message twice in a row (pressing E again on a locked terminal) shows once.
    setToasts((t) => (typeof text === "string" && t.some((x) => x.text === text) ? t : [...t.slice(-3), { id, text, tone }]));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Start the world once progress is known, so gates and terminals start right.
  const [canStartWorld, setCanStartWorld] = useState(false);
  useEffect(() => {
    if (state.ready) setCanStartWorld(true);
  }, [state.ready]);

  useEffect(() => {
    if (!canStartWorld || !host.current) return;
    let game: { destroy: (b: boolean) => void } | undefined;
    let dead = false;
    bridge.claimed = new Set(stateRef.current.claimed);
    bridge.level = stateRef.current.level;
    bridge.onReady = () => {
      if (!dead) setGameReady(true);
    };
    void import("./scene").then(({ startGame }) => {
      if (!dead && host.current) game = startGame(host.current, bridge);
    });
    return () => {
      dead = true;
      bridge.world = undefined;
      game?.destroy(true);
    };
  }, [canStartWorld, bridge]);

  // Progress into the world.
  useEffect(() => {
    if (!state.ready) return;
    bridge.claimed = new Set(state.claimed);
    bridge.level = state.level;
    bridge.world?.refresh();
  }, [bridge, state.ready, state.claimed, state.level, gameReady]);

  // Level-ups, wherever they come from.
  useEffect(() => {
    if (!state.ready) return;
    const prev = prevLevel.current;
    prevLevel.current = state.level;
    if (prev !== null && state.level > prev)
      setQueue((q) => [...q, ...Array.from({ length: state.level - prev }, (_, i) => ({ kind: "level" as const, n: prev + i + 1 }))]);
  }, [state.ready, state.level]);

  const head = queue.at(0);
  const showing = started && head && !panel && !dialog ? head : null;
  const blocked = !started || !!dialog || !!panel || !!showing || picking;

  useEffect(() => {
    const id = gameReady ? readChar() : null;
    if (id) setCharacter(id);
  }, [gameReady, setCharacter]);

  useEffect(() => {
    if (gameReady) bridge.world?.setPaused(!state.ready || blocked || mapUp);
  }, [bridge, state.ready, blocked, mapUp, gameReady]);

  const claimReach = useCallback(
    async (key: string) => {
      try {
        const r = await claim(key);
        if (r.right) {
          sfx.secret();
          bridge.world?.burst(0xffe08a);
          setQueue((q) => [{ kind: "secret", key, points: r.points, xp: r.xp }, ...q]);
        }
      } catch (e) {
        toast((e as Error).message, "bad");
        setTimeout(() => bridge.claimed.delete(key), 3000);
      }
    },
    [bridge, claim, toast],
  );

  // What the world reports.
  bridge.onInteract = (i: Interact) => {
    if (!started) return;
    // The key press that closed a conversation must not start it again.
    if (Date.now() - closedAt.current < 350) return;
    // While a conversation or a terminal is open, E belongs to it: never start another one underneath.
    if (dialog || panel) return;
    if (import.meta.env.DEV) console.debug("[quest] interact", JSON.stringify(i).slice(0, 80));
    const s = stateRef.current;
    if (i.kind === "npc") {
      const n = i.npc;
      const after = n.after && s.claimed.includes(n.after.item) ? n.after.lines : null;
      const portrait = n.portrait ? Number(n.portrait.match(/\d+/)?.[0]) || undefined : undefined;
      setDialog({ name: n.name, portrait, lines: after ?? n.lines, i: 0 });
      sfx.talk();
    } else if (i.kind === "poke") {
      setDialog({ name: "", lines: i.lines, i: 0 });
      sfx.talk();
    } else {
      const item = ITEMS.find((x) => x.key === i.key);
      if (!item) return;
      if (item.zone > s.level) {
        toast(`This terminal wakes up at level ${item.zone}. You're level ${s.level}.`, "bad");
        sfx.bump();
        return;
      }
      if (i.kind === "secret" && !item.question) void claimReach(item.key);
      else {
        sfx.open();
        // Stop the world now; open the panel after the key that opened it is done, so the E doesn't land in the answer box.
        bridge.world?.setPaused(true);
        setTimeout(() => setPanel(item.key), 90);
      }
    }
  };
  bridge.onRoom = (id) => {
    setRoomId(id);
    setBanner({ room: id, id: Math.random() });
    try {
      setVisited(JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]"));
    } catch {
      setVisited((v) => [...new Set([...v, id])]);
    }
  };
  bridge.onBlocked = (line) => toast(line, "bad");

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
  }, [banner]);

  // The title screen and global keys.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "m" || e.key === "M") && !panel) {
        const m = !isMuted();
        setMuted(m);
        setMutedState(m);
        unlock();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [started, state.ready, panel]);

  const closeOverlay = useCallback(() => {
    const h = queue.at(0);
    setQueue((q) => q.slice(1));
    if (h?.kind === "level") bridge.world?.celebrate(h.n);
  }, [bridge, queue]);

  const solved = useCallback(
    (item: QuestItem, r: { points: number; xp: number }) => {
      if (item.kind === "secret") sfx.secret();
      else sfx.right();
      bridge.world?.burst(item.kind === "secret" ? 0xffe08a : 0xfff1c8);
      toast(
        <>
          <b>{item.title}</b> solved · +{r.xp} XP{stateRef.current.live ? ` · +${r.points} Cup points` : ""}
        </>,
        "good",
      );
      if (item.key === FINAL) setQueue((q) => [...q, { kind: "ending" }]);
    },
    [bridge, toast],
  );

  const closePanel = useCallback(() => {
    sfx.close();
    setPanel(null);
    (document.activeElement as HTMLElement | null)?.blur();
    host.current?.focus();
  }, []);

  const item = started && panel ? ITEMS.find((i) => i.key === panel) : undefined;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#15162a] font-sans text-[#f4f8ff] select-none">
      <div ref={host} tabIndex={-1} className="absolute inset-0 outline-none [&_canvas]:block" data-testid="quest-canvas" />
      {/* A soft vignette over the world. */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_40px_rgba(10,10,30,0.75)]" />

      {started && gameReady && (
        <>
          <Hud
            state={state}
            place={roomById(roomId)?.name ?? ""}
            muted={muted}
            onMute={() => (setMuted(!muted), setMutedState(!muted), unlock())}
            room={roomId}
            visited={visited}
            paused={blocked}
            onChangeCharacter={() => setPicking(true)}
            onMap={setMapUp}
          />
        </>
      )}

      <Arrival banner={started && !panel ? banner : null} />
      <Toasts toasts={toasts} />

      {started && dialog && (
        <DialogBox
          d={dialog}
          onNext={() => setDialog((d) => (d && d.i < d.lines.length - 1 ? { ...d, i: d.i + 1 } : null))}
          onClose={() => setDialog(null)}
        />
      )}

      {item && <Panel key={item.key} item={item} state={state} claim={claim} onSolved={solved} onClose={closePanel} />}

      {showing?.kind === "level" && <LevelUp n={showing.n} live={state.live} onClose={closeOverlay} />}
      {showing?.kind === "secret" && (
        <SecretFound k={showing.key} points={showing.points} xp={showing.xp} live={state.live} onClose={closeOverlay} />
      )}
      {showing?.kind === "ending" && (
        <Ending
          state={state}
          onClose={() => {
            closeOverlay();
            sfx.close();
          }}
        />
      )}

      {started && picking && <CharacterPicker onChange={setCharacter} onDone={() => setPicking(false)} />}

      {!started && <Title state={state} onStart={enterWorld} onCharacter={setCharacter} />}
    </div>
  );
}

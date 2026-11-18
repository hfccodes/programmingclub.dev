// Snow Quest's link to the night: live when this browser joined tonight's open night on /hello-world/join (its token is
// in localStorage), practice otherwise. Practice needs no session and no sign-in: progress stays in this browser and
// earns no Cup points. Client only.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { WAIT_MS, check, itemByKey, levelBonus, levelFor } from "./quest";

export interface QuestState {
  /** False while loading. */
  ready: boolean;
  /** True for a joined night. False for local practice. */
  live: boolean;
  /** Whether the host opened the Snow Quest round. Local practice can always start. */
  started: boolean;
  /** True once officers end the night: `live` stays true and the saved points stay on screen, but nothing more scores. */
  ended: boolean;
  name: string;
  /** Per player per night. */
  seed: number;
  /** Item keys. */
  claimed: string[];
  xp: number;
  level: number;
  /** Cup points from the quest (with level-up bonuses). */
  points: number;
  /** Live standings, best first (just me in practice). Points here are the player's whole Cup score tonight. */
  board: { name: string; points: number; level: number; me: boolean }[];
}

/** What one claim earned. `right` false with `waitMs` > 0: a wrong answer (or still waiting from one). */
export interface ClaimResult {
  right: boolean;
  waitMs: number;
  points: number;
  xp: number;
  leveledTo: number | null;
}

const PRACTICE_KEY = "hwc.quest.practice";
/** How long after End night the game keeps showing that night's saved progress. */
const ENDED_FOR_MS = 12 * 60 * 60 * 1000;
const OVER = "Tonight’s game is over, so nothing more scores. Your points are saved: the TV shows the final standings.";
const tokenKey = (sessionId: string) => `hwc.token.${sessionId}`;

interface Practice {
  seed: number;
  claimed: string[];
  waits: Record<string, number>;
}

const newPractice = (): Practice => ({ seed: Math.floor(Math.random() * 2 ** 32) >>> 0, claimed: [], waits: {} });

function loadPractice(): Practice {
  try {
    const p = JSON.parse(localStorage.getItem(PRACTICE_KEY) ?? "null") as Partial<Practice> | null;
    if (p && typeof p.seed === "number" && Array.isArray(p.claimed)) return { seed: p.seed, claimed: p.claimed, waits: p.waits ?? {} };
  } catch {
    // Storage blocked or bad JSON: start fresh.
  }
  return newPractice();
}

function savePractice(p: Practice) {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: practice still works until the page reloads.
  }
}

function readToken(sessionId: string | undefined) {
  if (!sessionId) return null;
  try {
    return localStorage.getItem(tokenKey(sessionId));
  } catch {
    return null;
  }
}

function subscribeToken(refresh: () => void) {
  window.addEventListener("focus", refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener("focus", refresh);
    window.removeEventListener("storage", refresh);
  };
}

function practiceName() {
  try {
    const p = JSON.parse(localStorage.getItem("hwc.profile") ?? "null") as { name?: string } | null;
    if (p?.name) return p.name;
  } catch {
    // Fall through.
  }
  return "You";
}

const sumXp = (claimed: string[]) => claimed.reduce((n, k) => n + (itemByKey(k)?.xp ?? 0), 0);

export function useQuest(): {
  state: QuestState;
  claim: (key: string, answer?: string) => Promise<ClaimResult>;
  reset: () => void;
} {
  const night = useQuery(api.sessions.live);
  // No open night: the one that just ended, so End night doesn't drop a player back into practice with zero points.
  const last = useQuery(api.sessions.final, night === null ? {} : "skip");
  const recent = last && Date.now() - last.endedAt < ENDED_FOR_MS ? last : null;
  const sessionId = night ? night._id : recent?._id;
  // Still finding out which night this browser belongs to.
  const pending = night === undefined || (night === null && last === undefined);
  const token = useSyncExternalStore(
    subscribeToken,
    () => (pending ? undefined : readToken(sessionId)),
    () => undefined,
  );
  const [practice, setPracticeState] = useState<Practice | null>(null);
  // The latest practice progress, so two claims in a row never work from stale state.
  const practiceRef = useRef<Practice | null>(null);
  const setPractice = useCallback((p: Practice) => {
    practiceRef.current = p;
    setPracticeState(p);
  }, []);
  const [name, setName] = useState("You");

  useEffect(() => {
    setPractice(loadPractice());
    setName(practiceName());
  }, []);

  const me = useQuery(api.quest.me, token ? { token } : "skip");
  const live = !!token && !!me && me.sessionId === sessionId;
  const board = useQuery(api.quest.board, live && !me.ended ? {} : "skip");
  // The standings as they were when the night ended (the board query only covers an open night).
  const lastBoard = useRef<NonNullable<typeof board>>([]);
  if (board) lastBoard.current = board;
  const claimLive = useMutation(api.quest.claim);

  const state = useMemo<QuestState>(() => {
    if (live) {
      return {
        ready: true,
        live: true,
        started: me.started,
        ended: me.ended,
        name: me.name,
        seed: me.seed,
        claimed: me.claimed,
        xp: me.xp,
        level: me.level,
        points: me.points,
        board: (board ?? lastBoard.current).map((b) => ({ name: b.name, points: b.points, level: b.level, me: b.teamId === me.teamId })),
      };
    }
    const p = practice ?? { seed: 0, claimed: [], waits: {} };
    const xp = sumXp(p.claimed);
    const points = p.claimed.reduce((n, k) => n + (itemByKey(k)?.points ?? 0), 0) + levelBonus(0, xp);
    // Still waiting on Convex: the night, the token, or the player's row.
    const loading = pending || token === undefined || (!!token && me === undefined) || !practice;
    return {
      ready: !loading,
      live: false,
      started: true,
      ended: false,
      name,
      seed: p.seed,
      claimed: p.claimed,
      xp,
      level: levelFor(xp),
      points,
      board: [{ name, points, level: levelFor(xp), me: true }],
    };
  }, [live, me, board, practice, pending, token, name]);

  const claim = useCallback(
    async (key: string, answer?: string): Promise<ClaimResult> => {
      // Storage can change before the other tab's storage event reaches React.
      if (!state.ready || token !== readToken(sessionId)) throw new Error("Still connecting. Try again in a moment.");
      if (token && !live) throw new Error("Open the join page to check your team for this night.");
      if (live) {
        if (me.ended) throw new Error(OVER);
        try {
          return await claimLive({ token, key, answer });
        } catch (e) {
          // Show the server's sentence ("Reach level 3 to open this one.") as a plain Error message.
          if (e instanceof ConvexError && e.data === "This night has ended.") throw new Error(OVER);
          throw new Error(e instanceof ConvexError ? String(e.data) : "Couldn’t reach the server. Try again.");
        }
      }
      const p = practiceRef.current ?? loadPractice();
      const item = itemByKey(key);
      if (!item) throw new Error("That isn’t part of Snow Quest.");
      const none: ClaimResult = { right: true, waitMs: 0, points: 0, xp: 0, leveledTo: null };
      if (p.claimed.includes(key)) return none;
      const xpBefore = sumXp(p.claimed);
      const levelBefore = levelFor(xpBefore);
      if (item.zone > levelBefore) throw new Error(`Reach level ${item.zone} to open this one.`);
      const now = Date.now();
      if (item.question) {
        if (!answer?.trim()) throw new Error("Type your answer first.");
        const until = p.waits[key] ?? 0;
        if (now < until) return { ...none, right: false, waitMs: until - now };
        if (!check(key, p.seed, answer)) {
          const next = { ...p, waits: { ...p.waits, [key]: now + WAIT_MS } };
          setPractice(next);
          savePractice(next);
          return { ...none, right: false, waitMs: WAIT_MS };
        }
      }
      const next = { ...p, claimed: [...p.claimed, key] };
      setPractice(next);
      savePractice(next);
      const xp = xpBefore + item.xp;
      const level = levelFor(xp);
      return {
        right: true,
        waitMs: 0,
        points: item.points + levelBonus(xpBefore, xp),
        xp: item.xp,
        leveledTo: level > levelBefore ? level : null,
      };
    },
    [state.ready, sessionId, live, me, token, claimLive, setPractice],
  );

  const reset = useCallback(() => {
    if (live) return;
    const p = newPractice();
    setPractice(p);
    savePractice(p);
  }, [live, setPractice]);

  return { state, claim, reset };
}

// The reward moments: a level-up, a secret found, and the ending. Same props and keys as before.
import { useEffect } from "react";
import { ITEMS, LEVELS } from "../data";
import type { QuestState } from "../data";
import { sfx } from "../sound";
import { ART, Art, Key, Sparks, Studs, zoneName } from "./bits";

export function useEnter(onGo: () => void, delay = 600) {
  useEffect(() => {
    const at = Date.now();
    const down = (e: KeyboardEvent) => {
      if (Date.now() - at < delay) return;
      if (["Enter", " ", "e", "E", "Escape"].includes(e.key)) {
        e.preventDefault();
        onGo();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onGo, delay]);
}

const Continue = () => (
  <p className="qx-continue">
    <Key>Enter</Key> continue
  </p>
);

export function LevelUp({ n, live, onClose }: { n: number; live: boolean; onClose: () => void }) {
  const lv = LEVELS.find((l) => l.level === n);
  useEffect(() => sfx.levelup(), []);
  useEnter(onClose, 900);
  return (
    <div className="qx qx-scrim" onClick={onClose} data-testid="quest-levelup">
      <div className="qx-rays" aria-hidden />
      <div className="qx-moment">
        <Sparks n={18} />
        <p className="qx-ribbon">Level up</p>
        <p className="qx-display qx-big-num">Level {n}</p>
        <p className="qx-display qx-moment-title">{lv?.title}</p>
        <div className="qx-chips justify-center">
          {live && lv?.points ? <span className="qx-chip gold">+{lv.points} Cup points</span> : null}
        </div>
        {n <= 4 && <p className="qx-moment-line">The gate to {zoneName(n)} is opening…</p>}
        <Continue />
      </div>
    </div>
  );
}

export function SecretFound({
  k,
  points,
  xp,
  live,
  onClose,
}: {
  k: string;
  points: number;
  xp: number;
  live: boolean;
  onClose: () => void;
}) {
  const it = ITEMS.find((i) => i.key === k);
  useEnter(onClose, 700);
  return (
    <div className="qx qx-scrim" onClick={onClose} data-testid="quest-secret">
      <div className="qx-rays" aria-hidden />
      <div className="qx-moment">
        <div className="qx-frame qx-secret-card">
          <Sparks />
          <div className="qx-star" aria-hidden>
            ✦
          </div>
          <p className="qx-eyebrow">Secret found</p>
          <p className="qx-display mt-2 text-[2.2rem]">{it?.title}</p>
          {it?.found && <p className="mt-3 text-[1.15rem] leading-relaxed text-[var(--qx-cream)]">{it.found}</p>}
          <div className="mt-4">
            <div className="qx-chips justify-center">
              <span className="qx-chip gold">★ +{xp} XP</span>
              {live && <span className="qx-chip gold">+{points} Cup points</span>}
            </div>
          </div>
          <Continue />
          <Studs />
        </div>
      </div>
    </div>
  );
}

export function Ending({ state, onClose }: { state: QuestState; onClose: () => void }) {
  useEffect(() => sfx.ending(), []);
  useEnter(onClose, 1500);
  const secrets = ITEMS.filter((i) => i.kind === "secret");
  const found = secrets.filter((i) => state.claimed.includes(i.key)).length;
  return (
    <div className="qx qx-ending" data-testid="quest-ending">
      <Art src={`${ART}/ending.png`} alt="" className="qx-ending-art" />
      <div className="qx-ending-fade" />
      <div className="qx-moment qx-ending-text">
        <p className="qx-ribbon">The Winter Festival begins</p>
        <h2 className="qx-display qx-ending-title">You saved Pine Street</h2>
        <div className="qx-stats">
          <Stat n={state.level} label="Level" />
          <Stat n={state.xp} label="XP" />
          {state.live && <Stat n={state.points} label="Cup points" />}
          <Stat n={`${found}/${secrets.length}`} label="Secrets" />
        </div>
        <button className="qx-btn gold big mt-7" onClick={onClose}>
          {found < secrets.length ? "Keep exploring: secrets are still hidden" : "Back to town"}
        </button>
      </div>
    </div>
  );
}

const Stat = ({ n, label }: { n: number | string; label: string }) => (
  <div className="qx-stat">
    <b>{n}</b>
    <span>{label}</span>
  </div>
);

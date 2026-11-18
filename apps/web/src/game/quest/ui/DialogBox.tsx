// A townsperson talking: a framed portrait card, a gold name plate, lines that type themselves out, and a clear cue
// for what E does next. Same props and keys as before.
import { useEffect, useState } from "react";
import { sfx } from "../sound";
import { ART, Art, Key, Studs } from "./bits";

export interface Dialog {
  name: string;
  portrait?: number;
  lines: string[];
  i: number;
}

export function DialogBox({ d, onNext, onClose }: { d: Dialog; onNext: () => void; onClose: () => void }) {
  const line = d.lines[d.i];
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [line]);
  useEffect(() => {
    if (shown >= line.length) return;
    const t = setTimeout(() => {
      setShown((n) => Math.min(line.length, n + 2));
      if (shown % 6 === 0) sfx.talk();
    }, 22);
    return () => clearTimeout(t);
  }, [shown, line]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (["e", "E", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        // A held key repeats: only a fresh press moves the conversation on.
        if (e.repeat) return;
        if (shown < line.length) setShown(line.length);
        else onNext();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [shown, line, onNext, onClose]);
  const typing = shown < line.length;
  const last = d.i >= d.lines.length - 1;
  return (
    <div className="qx">
      <div className="qx-frame qx-dialog" data-testid="quest-dialog" onClick={() => (typing ? setShown(line.length) : onNext())}>
        {d.portrait && (
          <div className="qx-portrait">
            <Art src={`${ART}/npc-${d.portrait}.png`} alt="" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {d.name && <p className="qx-nameplate">{d.name}</p>}
          {/* The whole line is laid out from the start, so the box never grows while it types. */}
          <p className="qx-dialog-line" aria-live="polite">
            {line.slice(0, shown)}
            <span className="invisible" aria-hidden>
              {line.slice(shown)}
            </span>
          </p>
          <div className="qx-dialog-foot">
            <div className="qx-pips" aria-label={`Line ${d.i + 1} of ${d.lines.length}`}>
              {d.lines.length > 1 && d.lines.map((_, i) => <i key={i} className={i <= d.i ? "on" : ""} />)}
            </div>
            <span className="flex items-center gap-4">
              <span>
                <Key>Esc</Key> close
              </span>
              <span className="qx-next">
                <Key>E</Key> {typing ? "skip" : last ? "done" : "next"}
                <span className="arrow" aria-hidden>
                  {last && !typing ? "■" : "▼"}
                </span>
              </span>
            </span>
          </div>
        </div>
        <Studs />
      </div>
    </div>
  );
}

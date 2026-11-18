// The terminal panel: the town's old terminal, opened. Story, the question as the hero, the player's input, and an
// answer dock that never scrolls away. Same props and behaviour as before; only the look is the game's own.
import { useEffect, useMemo, useRef, useState } from "react";
import type { QuestItem, QuestState, useQuest } from "../data";
import { sfx } from "../sound";
import { ART, Art, CheckIcon, Chevron, Code, CopyIcon, DownloadIcon, Key, QText, Rich, Sparks, Studs } from "./bits";
import { PyPad } from "./PyPad";

export function Panel({
  item,
  state,
  claim,
  onSolved,
  onClose,
}: {
  item: QuestItem;
  state: QuestState;
  claim: ReturnType<typeof useQuest>["claim"];
  onSolved: (item: QuestItem, r: { points: number; xp: number }) => void;
  onClose: () => void;
}) {
  const input = useMemo(() => item.input?.(state.seed), [item, state.seed]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [until, setUntil] = useState(0);
  const [total, setTotal] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(0);
  const [hint, setHint] = useState(false);
  // The hint ladder: how many of `hints` are open (at least 1 once "Need a hint?" is pressed).
  const ladder = item.hints?.length ? item.hints : item.hint ? [item.hint] : [];
  const [hintsOpen, setHintsOpen] = useState(1);
  const moreHints = ladder.length > 0 && (!hint || hintsOpen < ladder.length);
  // A snippet from a hint, sent to the Python box.
  const [send, setSend] = useState<{ code: string; id: number } | null>(null);
  const [example, setExample] = useState(false);
  const [won, setWon] = useState<{ points: number; xp: number; level: number | null } | null>(null);
  const done = state.claimed.includes(item.key);
  const answerRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const closed = useRef(false);
  const closeOnce = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  const left = Math.max(0, until - now) / total;

  useEffect(() => {
    answerRef.current?.focus({ preventScroll: true });
  }, []);
  // Solved: the way back to town is one Enter away.
  useEffect(() => {
    if (!won) return;
    backRef.current?.focus({ preventScroll: true });
    // The celebration closes the terminal by itself; Enter, Esc or a click closes it sooner.
    const t = setTimeout(closeOnce, SOLVED_MS);
    return () => clearTimeout(t);
    // Once per solve.
  }, [won]);
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [until]);
  // Back in the box once the terminal has rebooted, ready for the next try.
  useEffect(() => {
    if (until && wait === 0 && !(document.activeElement instanceof HTMLTextAreaElement)) answerRef.current?.focus({ preventScroll: true });
  }, [until, wait]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOnce();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await claim(item.key, answer);
      if (r.right) {
        setWon({ points: r.points, xp: r.xp, level: r.leveledTo });
        onSolved(item, r);
      } else {
        sfx.wrong();
        setUntil(Date.now() + r.waitMs);
        setTotal(Math.max(1, r.waitMs));
        setNow(Date.now());
        setShake((s) => s + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const ready = !!answer.trim() && !busy && wait === 0;
  const isCode = !!input && /print\(/.test(input);
  // Short data (or code, which is read rather than processed) sits right inside the question card.
  const short = !!input && (isCode || (input.split("\n").length <= 3 && input.length <= 120));
  // Long lists get the wide workspace (question left, Python right) when the game area is wide enough.
  const roomy = useRoomy();
  const wide = roomy && !!input && !short && !isCode;
  const [printed, setPrinted] = useState("");
  const lastNumber = /^-?\d+$/.test(printed.trim().split("\n").at(-1)?.trim() ?? "") ? printed.trim().split("\n").at(-1)!.trim() : null;
  const placeholder = /print/i.test(item.question ?? "")
    ? "Type what it prints"
    : /really say|message/i.test(item.question ?? "")
      ? "Type the message"
      : "Type a number";
  const leftCol = (
    <>
      {done && !won && (
        <div className="qx-solved" role="status">
          <div className="qx-solved-badge" aria-hidden>
            ★
          </div>
          <div className="min-w-0 flex-1">
            <p className="qx-display qx-solved-title">Already fixed</p>
            <p className="mt-1">This terminal is already fixed. Nice work.</p>
            {item.found && <p className="mt-1">{item.found}</p>}
            <button className="qx-btn" onClick={onClose}>
              Back to town <Key>Esc</Key>
            </button>
          </div>
        </div>
      )}

      {item.story && (
        <div className="qx-story">
          <QText text={item.story} />
        </div>
      )}

      {item.question && (
        <div className="qx-question">
          <div className="qx-question-text">
            <QText text={item.question} />
          </div>
          {input && short && (
            <div className="qx-mine">
              <p className="qx-mine-label">{isCode ? "Your code" : /^[\d\s]+$/.test(input) ? "Your numbers" : "Yours"}</p>
              {isCode ? <Code code={input} /> : <p className="qx-mine-data">{input}</p>}
            </div>
          )}
        </div>
      )}

      {(item.example || ladder.length > 0) && (
        <div className="qx-help">
          <div className="qx-help-row">
            {item.example && (
              <button className="qx-help-btn" aria-expanded={example} onClick={() => setExample(!example)}>
                <Chevron /> See an example
              </button>
            )}
            {ladder.length > 0 && (
              <button className="qx-help-btn" aria-expanded={hint} onClick={() => setHint(!hint)}>
                <Chevron /> Need a hint?
              </button>
            )}
          </div>
          {example && item.example && (
            <div className="qx-example qx-reveal">
              <p className="qx-example-label">Example, not yours</p>
              <Code code={item.example.input} className="max-h-40" />
              <p className="mt-2">
                <span className="qx-answer-tag">
                  <span className="qx-mute text-sm">Its answer</span> <code>{item.example.answer}</code>
                </span>{" "}
                <Rich text={item.example.why} />
              </p>
            </div>
          )}
          {hint && (
            <div className="qx-hint-card qx-reveal">
              {ladder.slice(0, hintsOpen).map((h, i) => (
                <div key={i} className={`qx-hint-step ${i === hintsOpen - 1 && i > 0 ? "qx-reveal" : ""}`}>
                  {ladder.length > 1 && <p className="qx-hint-num">Hint {i + 1}</p>}
                  <div className="qx-hint-text">
                    <QText
                      text={h}
                      onCode={input && !isCode && i < ladder.length - 1 ? (code) => setSend({ code, id: Math.random() }) : undefined}
                    />
                    {ladder.length > 1 && i === ladder.length - 1 && h.includes("\n    ") && (
                      <p className="qx-hint-own">Type this one in yourself: it sticks better.</p>
                    )}
                  </div>
                </div>
              ))}
              {hintsOpen < ladder.length && (
                <button className="qx-btn sm qx-hint-next" onClick={() => setHintsOpen(hintsOpen + 1)}>
                  Show the next hint ({hintsOpen + 1} of {ladder.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className={`qx qx-panel-wrap ${wide ? "wide" : ""}`} data-testid="quest-panel">
      <div className="qx-frame qx-panel" role="dialog" aria-labelledby="qx-panel-title">
        <header className="qx-panel-head">
          <div className="qx-icon-frame">
            <Art src={`${ART}/terminal.png`} alt="" fallback={<div />} />
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="qx-panel-title" className="qx-display qx-panel-title">
              {item.title}
            </h2>
            <span className="qx-chips">
              <span className="qx-chip gold">+{item.xp} XP</span>
              {state.live && <span className="qx-chip gold">+{item.points} Cup points</span>}
              {!state.live && <span className="qx-chip ice">Practice</span>}
              {(won || done) && <span className="qx-chip ice">✓ Solved</span>}
            </span>
          </div>
          <button className="qx-btn sm" onClick={closeOnce}>
            Back to town <Key>Esc</Key>
          </button>
        </header>

        {wide ? (
          <div className="qx-ws">
            <div className="qx-ws-left">{leftCol}</div>
            <div className="qx-ws-right">
              <PyPad
                item={item}
                input={input}
                big
                send={send}
                fixed
                onPrinted={setPrinted}
                onUse={(n) => (setAnswer(n), answerRef.current?.focus())}
                listPane={input && <InputBox input={input} compact />}
              />
            </div>
          </div>
        ) : (
          <div className="qx-panel-body">
            {leftCol}
            {input && !short && <InputBox input={input} />}

            <PyPad item={item} input={input} big={!!input && !short && !isCode} send={send} />
          </div>
        )}

        {!done && !won && (
          <form
            className={`qx-dock ${wait > 0 ? "wrong" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void submit();
            }}
          >
            <div className="qx-dock-label">
              <label className="qx-eyebrow" htmlFor="quest-answer">
                Your answer
              </label>
              <span className="qx-mute text-sm">
                <Key>Enter</Key> to submit
              </span>
            </div>
            <div key={shake} className={`qx-dock-row ${shake ? "qx-shake" : ""}`}>
              <div className="qx-answer-field">
                <span className="prompt" aria-hidden>
                  ›
                </span>
                <input
                  id="quest-answer"
                  ref={answerRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={200}
                />
              </div>
              {wide && lastNumber && lastNumber !== answer.trim() && (
                <button type="button" className="qx-btn qx-use" onClick={() => (setAnswer(lastNumber), answerRef.current?.focus())}>
                  Use {lastNumber}
                </button>
              )}
              <button className="qx-btn gold big" disabled={!ready}>
                {busy ? "Checking…" : wait > 0 ? `Wait ${wait}s` : "Submit"}
              </button>
            </div>
            {wait > 0 && (
              <div className="qx-cool">
                <div className="flex-1">
                  <p role="alert" className="qx-cool-msg">
                    Not quite. Try again in {wait}s.{" "}
                    {moreHints
                      ? hint
                        ? "Stuck? There is another hint above."
                        : "Stuck? Open “Need a hint?” above."
                      : "Read it again, line by line."}
                  </p>
                  <div className="qx-cool-bar" aria-hidden>
                    <i style={{ transform: `scaleX(${left})` }} />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="qx-error">
                {error}
              </p>
            )}
          </form>
        )}
        {won && (
          <div className="qx-won" onClick={closeOnce} role="status" data-testid="quest-solved">
            <div className="qx-solved fresh qx-won-card">
              <Sparks />
              <div className="qx-solved-badge" aria-hidden>
                ★
              </div>
              <div className="min-w-0 flex-1">
                <p className="qx-display qx-solved-title">Solved!</p>
                <div className="qx-won-rewards">
                  <span className="qx-chip gold">+{won.xp} XP</span>
                  {state.live && won.points > 0 && <span className="qx-chip gold">+{won.points} Cup points</span>}
                  {won.level && <span className="qx-chip red">Level up! Level {won.level}</span>}
                </div>
                {item.found && <p className="mt-2">{item.found}</p>}
                <button ref={backRef} className="qx-btn sm mt-3" onClick={closeOnce}>
                  Back to town <Key>Enter</Key>
                </button>
                <div className="qx-won-timer" aria-hidden>
                  <i style={{ animationDuration: `${SOLVED_MS}ms` }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <Studs />
      </div>
    </div>
  );
}

/** How long the Solved celebration stays before the terminal closes by itself. */
const SOLVED_MS = 1600;

/** Copies text, also on plain http (a LAN address), where the Clipboard API is missing. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = Object.assign(document.createElement("textarea"), { value: text });
    t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}

/** A long list of the player's own, to read, copy, or download as input.txt. */
function InputBox({ input, compact }: { input: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const rows = input.split("\n");
  const copy = async () => {
    if (await copyText(input)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else download();
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([input + "\n"], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "input.txt" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (compact)
    return (
      <section className="qx-pane">
        <p className="qx-pane-head">
          <span className="qx-pane-title">Your list</span>
          <span className="qx-pane-sub">
            {rows.length} lines · in <code className="qx-code-inline">lines</code>
          </span>
          <button className="qx-icon-btn sm" onClick={() => void copy()} aria-label="Copy the list" title={copied ? "Copied" : "Copy"}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button className="qx-icon-btn sm" onClick={download} aria-label="Download input.txt" title="Download input.txt">
            <DownloadIcon />
          </button>
        </p>
        <pre className="qx-code qx-pane-body" tabIndex={0} aria-label="Your list">
          {input}
        </pre>
      </section>
    );
  return (
    <section className="qx-section qx-list">
      <div className="qx-section-head">
        <p className="min-w-0 flex-1">
          <span className="qx-section-title">Your list</span>{" "}
          <span className="qx-section-sub">· {rows.length} lines, different for every player</span>
        </p>
        <button className="qx-quiet" onClick={() => void copy()}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="qx-quiet" onClick={download}>
          <DownloadIcon /> Download
        </button>
      </div>
      <div className="qx-section-body">
        <p className="qx-section-sub">
          Too long to do by hand: use the Python box below (your list is already loaded in it), or copy it into your own editor.
        </p>
        <pre className="qx-code qx-list-code" tabIndex={0} aria-label="Your list">
          {input}
        </pre>
      </div>
    </section>
  );
}

/** Whether the game area is wide enough for the two-column workspace. */
function useRoomy() {
  const get = () => typeof window !== "undefined" && Math.min(window.innerWidth, (window.innerHeight * 16) / 9) >= 1100;
  const [roomy, setRoomy] = useState(get);
  useEffect(() => {
    const on = () => setRoomy(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return roomy;
}

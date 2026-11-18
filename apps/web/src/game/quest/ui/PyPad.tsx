// The Python scratchpad inside a terminal panel: the site's Python runner in the game's own frame, with a highlighted
// editor (a transparent textarea over coloured code), Run buttons and an output screen.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { errorLine } from "#/components/fix";
import { usePython } from "#/lib/python";
import type { PyRun } from "#/lib/python";
import type { QuestItem } from "../data";
import { Chevron, Rich, highlight } from "./bits";
import { pyKey, pyPaste } from "./pyKeys";

const STARTER_INPUT = `# Your list is already here, one line per item, in lines.
lines = open("input.txt").read().splitlines()
print(len(lines), "lines")
print(lines[0])
`;
const STARTER_NONE = `# Try things here. Click Run.
print("hello, Pine Street")
`;

export function PyPad({
  item,
  input,
  big,
  send,
  fixed,
  onPrinted,
  onUse,
  listPane,
}: {
  item: QuestItem;
  input?: string;
  big?: boolean;
  /** A snippet from a hint: it goes into the editor after the line that reads the list, and the pad opens. */
  send?: { code: string; id: number } | null;
  /** The wide workspace: always open, the editor fills the column, the output has a fixed share below. */
  fixed?: boolean;
  /** What the last run on the player's list printed. */
  onPrinted?: (text: string) => void;
  /** Puts a printed number into the answer box. */
  onUse?: (n: string) => void;
  /** The workspace's list pane, shown beside the output. */
  listPane?: ReactNode;
}) {
  const [opened, setOpen] = useState(false);
  const open = fixed || opened;
  const box = useRef<HTMLElement>(null);
  const py = usePython(open);
  // When the player's own data is code (the cocoa stand), the pad starts with that code, ready to run.
  const isCode = !!input && /print\(/.test(input);
  const starter = isCode ? `${input}\n` : input ? STARTER_INPUT : STARTER_NONE;
  // The cocoa stand's code differs per player and per night, so a saved copy is only for that exact code.
  const saveKey = `quest:code:${item.key}${isCode ? `:${[...input].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)}` : ""}`;
  const [code, setCode] = useState(starter);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<{ on: "example" | "input"; out: PyRun; code: string } | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(saveKey);
      if (saved) setCode(saved);
    } catch {
      // fine
    }
  }, [saveKey]);
  const edit = (c: string) => {
    setCode(c);
    try {
      localStorage.setItem(saveKey, c);
    } catch {
      // fine
    }
  };
  useEffect(() => {
    if (!send) return;
    const head = send.code.includes('open("input.txt")') ? "" : STARTER_INPUT.split("\n").slice(0, 2).join("\n") + "\n";
    // Keep what the player has written: the hint goes underneath it. An untouched pad starts from the hint.
    edit(code.trim() && code !== starter ? `${code.trimEnd()}\n\n${send.code}\n` : head + send.code + "\n");
    setOpen(true);
    if (!fixed)
      setTimeout(
        () =>
          box.current?.scrollIntoView({
            block: "start",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          }),
        60,
      );
    // Only when a new snippet arrives.
  }, [send]);
  const go = async (on: "example" | "input") => {
    setBusy(true);
    const text = on === "example" ? (item.example?.input ?? "") : (input ?? "");
    const out = await py.run(code, text, { "input.txt": text }).catch(() => null);
    if (out) setRun({ on, out, code });
    if (out && on === "input") onPrinted?.(out.error ? "" : out.stdout);
    setBusy(false);
  };
  const can = py.status === "ready" && !busy;
  const printed = run?.out.stdout.replace(/\n+$/, "") ?? "";
  // A run on the player's list whose last line is one number: that's probably the answer.
  const tail = printed.split("\n").at(-1)?.trim() ?? "";
  const lastNum = run?.on === "input" && !run.out.error && /^-?\d+$/.test(tail) ? tail : null;
  return (
    <section ref={box} className={`qx-section qx-pad ${big ? "big" : ""} ${fixed ? "ws" : ""}`}>
      {fixed ? (
        <p className="qx-ws-padhead">
          <span className="qx-section-title">Solve it with Python</span>{" "}
          <span className="qx-section-sub">· Enter keeps your indent · Tab / Shift+Tab move lines in or out</span>
          <button className="qx-quiet ml-auto" onClick={() => edit(starter)} disabled={code === starter}>
            Reset code
          </button>
        </p>
      ) : (
        <button className="qx-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron />
          <span className="min-w-0 flex-1">
            <span className="qx-section-title">{big ? "Solve it with Python" : "Python scratchpad"}</span>{" "}
            <span className="qx-section-sub">· {big ? "your list is already loaded, nothing to install" : "try code right here"}</span>
          </span>
          <span className="glyph" aria-hidden>
            ›_
          </span>
        </button>
      )}
      {open && (
        <div className={fixed ? "qx-ws-pad" : "qx-section-body qx-reveal"}>
          {!fixed && (
            <div className="flex items-center justify-between gap-2">
              <p className="qx-section-sub">
                <b className="text-[var(--qx-cream)]">Your code</b> · Enter keeps your indent · Tab / Shift+Tab move a line in or out · Esc
                then Tab leaves
              </p>
              <button className="qx-quiet" onClick={() => edit(starter)} disabled={code === starter}>
                Reset code
              </button>
            </div>
          )}
          <Editor
            value={code}
            onChange={edit}
            mark={run?.out.error && run.code === code ? errorLine(run.out.error) : undefined}
            onRun={() => can && void go("input")}
          />
          <div className="qx-pad-bar">
            <button className="qx-btn ice" disabled={!can} onClick={() => void go("input")}>
              ▶ {input && !isCode ? "Run on my list" : "Run"}
            </button>
            {item.example && !isCode && (
              <button className="qx-btn" disabled={!can} onClick={() => void go("example")}>
                Run on the example
              </button>
            )}
            <Status status={py.status} busy={busy} />
          </div>
          {fixed ? (
            <div className="qx-ws-row">
              {listPane}
              <div className="qx-ws-outpane">
                {!run && (
                  <div className="qx-out empty">
                    <p className="qx-out-head">Output</p>
                    <p className="qx-out-empty">Press Run: what your program prints shows up here.</p>
                  </div>
                )}
                {run && (
                  <div className={`qx-out ${run.code !== code ? "stale" : ""} ${run.out.error || run.out.timedOut ? "crashed" : ""}`}>
                    <p className="qx-out-head" role="status">
                      <span className="qx-out-title">{headline(run, input && !isCode ? "On your list" : "Output")}</span>
                      {run.code !== code && <span className="qx-out-stale">edited · run again</span>}
                      {onUse && lastNum && (
                        <button className={`qx-btn sm qx-use ${run.code !== code ? "" : "ml-auto"}`} onClick={() => onUse(lastNum)}>
                          Use {lastNum}
                        </button>
                      )}
                    </p>
                    {run.out.error && <Trace text={run.out.error} />}
                    {(printed || !run.out.error) && !run.out.timedOut && (
                      <>
                        {run.out.error && <p className="qx-out-before">Printed before it stopped:</p>}
                        <pre className="qx-code wrap">
                          {lastNum ? (
                            <>
                              {printed.slice(0, printed.lastIndexOf(lastNum))}
                              <mark className="qx-out-num">{lastNum}</mark>
                            </>
                          ) : (
                            printed || "(nothing)"
                          )}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {run && (
                <div className={`qx-out ${run.code !== code ? "stale" : ""} ${run.out.error || run.out.timedOut ? "crashed" : ""}`}>
                  <p className="qx-out-head" role="status">
                    <span className="qx-out-title">{headline(run, input && !isCode ? "On your list" : "Output")}</span>
                    {run.code !== code && <span className="qx-out-stale">edited · run again</span>}
                    {onUse && lastNum && (
                      <button className={`qx-btn sm qx-use ${run.code !== code ? "" : "ml-auto"}`} onClick={() => onUse(lastNum)}>
                        Use {lastNum}
                      </button>
                    )}
                  </p>
                  {run.out.error && <Trace text={run.out.error} />}
                  {(printed || !run.out.error) && !run.out.timedOut && (
                    <>
                      {run.out.error && <p className="qx-out-before">Printed before it stopped:</p>}
                      <pre className="qx-code wrap">
                        {lastNum ? (
                          <>
                            {printed.slice(0, printed.lastIndexOf(lastNum))}
                            <mark className="qx-out-num">{lastNum}</mark>
                          </>
                        ) : (
                          printed || "(nothing)"
                        )}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Status({ status, busy }: { status: "loading" | "ready" | "failed"; busy: boolean }) {
  if (status === "failed")
    return (
      <p role="alert" className="qx-pad-status bad">
        Python didn’t load. Check the internet, then reload.
      </p>
    );
  if (status === "loading")
    return (
      <p role="status" className="qx-pad-status">
        Waking up Python…
      </p>
    );
  return <p className="qx-pad-status">{busy ? "Running…" : ""}</p>;
}

/** An editor: line numbers, warm syntax colours, Tab adds 4 spaces (Esc, then Tab, moves on). `mark` flags Python's stop. */
function Editor({ value, onChange, mark, onRun }: { value: string; onChange: (v: string) => void; mark?: number; onRun?: () => void }) {
  const n = value.split("\n").length;
  const escaped = useRef(false);
  return (
    <div className="qx-editor">
      <pre aria-hidden className="qx-editor-gutter">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={i + 1 === mark ? "bad" : "block"}>
            {i + 1}
          </span>
        ))}
      </pre>
      <div className="qx-editor-scroll">
        <div className="qx-editor-grid">
          {/* A trailing space keeps the last empty line's height. */}
          <pre aria-hidden>{highlight(value)} </pre>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => pyPaste(e) && e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                escaped.current = true;
                e.stopPropagation();
                return;
              }
              // Esc, then Tab, leaves the editor; otherwise Tab indents.
              if (!(e.key === "Tab" && escaped.current) && pyKey(e, e.currentTarget, onRun)) e.preventDefault();
              escaped.current = false;
            }}
            rows={n}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Your program"
            title="Esc, then Tab, leaves the editor. Ctrl+Enter runs on your list. Ctrl+/ comments a line."
          />
        </div>
      </div>
    </div>
  );
}

/** The header of a run: where the program is, in plain words. */
function headline(run: { on: "example" | "input"; out: PyRun }, mine: string) {
  if (run.out.timedOut) return "Ran too long, stopped";
  const where = run.on === "example" ? "On the example" : mine;
  if (!run.out.error) return where;
  const line = errorLine(run.out.error);
  return line ? `Stopped on line ${line}` : `${where} · stopped`;
}

/** What a Python error means, in words a beginner can act on. Python's own line stays underneath. */
function explain(last: string) {
  const [, kind = "", msg = ""] = /^(\w+(?:Error|Exception)?):?\s*(.*)$/.exec(last) ?? [];
  const q = (t?: string) => (t ? `\`${t}\`` : "");
  let m: RegExpExecArray | null;
  if (kind === "NameError" && (m = /name '([^']+)' is not defined(?:.*Did you mean: '([^']+)')?/.exec(msg)))
    return `Python doesn't know the name ${q(m[1])}.${m[2] ? ` Did you mean ${q(m[2])}? Check the spelling.` : " Is it spelled the same everywhere, and set before it's used?"}`;
  if (kind === "IndentationError")
    return "The spaces at the start of a line don't line up. Lines inside a for or if need 4 more spaces than the line above.";
  if (kind === "SyntaxError")
    return /never closed|unmatched|was not closed/.test(msg)
      ? "A bracket or quote was opened but never closed."
      : /expected ':'/.test(msg)
        ? "A line that starts with for, if, else or while needs a colon `:` at the end."
        : "Python can't read this line: look for a missing colon, bracket or quote.";
  if (kind === "TypeError" && /can only concatenate str|unsupported operand/.test(msg))
    return "You're mixing text and numbers. Use `int(...)` to turn text into a number first.";
  if (kind === "ValueError" && /invalid literal for int/.test(msg)) return "`int(...)` got something that isn't a whole number.";
  if (kind === "IndexError") return "You asked for an item past the end of the list.";
  if (kind === "ZeroDivisionError") return "Something was divided by zero.";
  if (kind === "AttributeError" && (m = /has no attribute '([^']+)'/.exec(msg)))
    return `That kind of value has no ${q(m[1])}. Check the spelling.`;
  if (kind === "KeyError") return `The key ${msg} isn't in the dictionary yet.`;
  return null;
}

/** A crash: what it means, Python's own words, and the whole traceback a click away. */
function Trace({ text }: { text: string }) {
  const all = text.trimEnd().split("\n");
  const last = all.at(-1) ?? "";
  const plain = explain(last);
  return (
    <div className="qx-trace">
      {plain && (
        <p className="qx-trace-plain">
          <Rich text={plain} />
        </p>
      )}
      <p className="qx-trace-last">{last}</p>
      {all.length > 1 && (
        <details>
          <summary>Full traceback</summary>
          <pre tabIndex={0} className="qx-code mt-1 max-h-48">
            {all.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

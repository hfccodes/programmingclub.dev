// Fix it for real on a laptop: the task, the examples, an editor with the buggy program, Run, and Check.
// Presentational: components/workspace.tsx wires it to Convex, and the officer test page drives it with local state.
import { ConvexError } from "convex/values";
import { Fragment, useEffect, useRef, useState } from "react";
import { FIXES } from "#/lib/fixes";
import type { FixTest } from "#/lib/fixes";
import { TIMEOUT_MS, runTests } from "#/lib/python";
import type { Python, TestResult } from "#/lib/python";
import { RealBug } from "./answer";
import { useConfirm } from "./feedback";
import { FixHint, LevelChip, fixedLines, fmtElapsed } from "./game";
import { Code } from "./ui";

export interface FixResult {
  points: number;
  first: boolean;
}

interface Props {
  index: number;
  py: Python;
  revealed: boolean;
  hint: boolean;
  /** Fixes close at 0:00 or the reveal. */
  open: boolean;
  /** The team's fix, once the server has it: time on the card's clock (null if the clock never started). */
  fixed: { ms: number | null } | null;
  result: FixResult | null;
  /** Keeps edits through a reload. */
  saveKey?: string;
  /** Called once every test passes. Throw a ConvexError to show why it didn't count. */
  onFixed: (code: string) => Promise<unknown>;
}

export function FixRound({ index, py, revealed, hint, open, fixed, result, saveKey, onFixed }: Props) {
  const confirm = useConfirm();
  const resetting = useRef<symbol | null>(null);
  const card = FIXES[index];
  const [code, setCode] = useState(card.code);
  const [busy, setBusy] = useState<"run" | "check" | null>(null);
  const [results, setResults] = useState<{ kind: "run" | "check"; list: TestResult[]; planned: number; code: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      resetting.current = null;
    },
    [],
  );

  useEffect(() => {
    const saved = saveKey && localStorage.getItem(saveKey);
    if (saved) setCode(saved);
  }, [saveKey]);
  const edit = (c: string) => {
    setCode(c);
    if (saveKey) localStorage.setItem(saveKey, c);
  };

  const resetCode = async () => {
    if (code === card.code || resetting.current !== null) return;
    const request = Symbol();
    resetting.current = request;
    try {
      const yes = await confirm({
        title: "Start over from the buggy program?",
        description: "Your changes will be gone.",
        confirmLabel: "Reset code",
        destructive: true,
      });
      if (yes && resetting.current === request) edit(card.code);
    } finally {
      if (resetting.current === request) resetting.current = null;
    }
  };

  const go = async (kind: "run" | "check") => {
    setBusy(kind);
    setError("");
    const tests = card.tests.map((test, i) => ({ i, test })).filter(({ test }) => kind === "check" || test.show);
    const list = await runTests(py, code, tests).catch(() => null);
    if (!list) setError("Python isn’t ready. Reload the page and try again.");
    else {
      setResults({ kind, list, planned: tests.length, code });
      if (kind === "check" && !fixed && list.length === card.tests.length && list.every((r) => r.pass))
        await onFixed(code).catch((e: unknown) =>
          setError(
            e instanceof ConvexError
              ? String(e.data)
              : "Your fix works, but it didn’t reach the scoreboard. Check the connection and press Check again.",
          ),
        );
    }
    setBusy(null);
  };

  const hidden = card.tests.filter((t) => !t.show).length;
  const shown = card.tests.length - hidden;
  const can = py.status === "ready" && !busy;
  // What the last run says about the code in the editor now: stale once it's edited.
  const fresh = !!results && results.code === code;
  const crashLine = fresh
    ? results.list.flatMap((r) => (r.run.error ? [errorLine(r.run.error)] : [])).find((l) => l !== undefined)
    : undefined;
  // A laptop: the task and its example on the left; on the right, one pane that stays in view under the bar: the editor,
  // Run and Check under it, and what they found under those, in a box of its own that scrolls when it runs long, so a
  // long traceback never pushes the code off the screen. Narrower or shorter screens stack it all in that order.
  return (
    <div className="@container/fix">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[56rem]:grid-cols-[minmax(0,1fr)_minmax(34rem,1.15fr)] @min-[56rem]:items-start @min-[56rem]:gap-5">
        <section aria-labelledby="fix-task" className="card space-y-4 p-5 @min-[56rem]:p-4">
          <div>
            <p className="text-sm font-bold text-dim">
              Fix it for real
              <LevelChip level={card.level} />
            </p>
            <h2 id="fix-task" className="mt-1 text-3xl lowercase">
              {card.name}
            </h2>
            <p className="mt-2 text-lg leading-snug">{card.task}</p>
          </div>
          <Examples tests={card.tests.filter((t) => t.show)} />
          {hint && !revealed && <FixHint card={card} />}
          {revealed && (
            <div className="border-t-2 border-dashed border-line pt-4">
              <p>
                <strong className="font-extrabold">The fix.</strong> {card.why}
              </p>
              <Code code={card.fix} mark={fixedLines(card)} className="mt-2" />
              {card.source && <RealBug source={card.source} className="mt-3" />}
            </div>
          )}
        </section>

        {/* --ws-top: how far down the page's own sticky bar reaches, if it has one (the join page sets it). */}
        <section
          aria-label="Your fix"
          className="flex min-w-0 flex-col gap-3 @container ws:sticky ws:top-(--ws-top,1rem) ws:max-h-[calc(100dvh-var(--ws-top,1rem)-1rem)]"
        >
          <Status revealed={revealed} open={open} fixed={fixed} result={result} />
          {/* The editor keeps its size; only on a cramped screen does it give up rows (and scroll) so results still show. */}
          <div className="flex min-h-[9rem] flex-col">
            <EditorHead note="find the bug and change it here" onReset={() => void resetCode()} changed={code !== card.code} />
            <Editor value={code} onChange={edit} fit={card.code} mark={crashLine} className="min-h-0" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
            <button className="btn" disabled={!can} onClick={() => void go("run")}>
              {busy === "run" ? "Running…" : shown === 1 ? "Run the example" : "Run the examples"}
            </button>
            <button className="btn btn-primary" disabled={!can || (!open && !fixed)} onClick={() => void go("check")}>
              {busy === "check" ? "Checking…" : "Check my fix"}
            </button>
            {py.status === "ready" && (
              <p className="min-w-[12rem] flex-1 text-sm leading-snug text-dim">
                Check runs {hidden} hidden test{hidden === 1 ? "" : "s"} too. Your fix counts once all pass.
              </p>
            )}
          </div>
          <PyState status={py.status} />
          {error && (
            <p role="alert" className="shrink-0 rounded-[6px] bg-signal/10 px-4 py-3 font-semibold text-[#a8321f]">
              {error}
            </p>
          )}
          {results && <Results {...results} total={card.tests.length} stale={!fresh} fixed={!!fixed} />}
        </section>
      </div>
    </div>
  );
}

/** Python's loading state. Once it's ready, `ready` (if any) says what the buttons do. */
export function PyState({ status, ready }: { status: Python["status"]; ready?: string }) {
  if (status === "ready") return ready ? <p className="text-sm text-dim">{ready}</p> : null;
  if (status === "failed")
    return (
      <p role="alert" className="font-semibold text-[#a8321f]">
        Python didn’t load. Check the internet connection, then reload the page.
      </p>
    );
  return (
    <p className="font-semibold" role="status">
      Getting Python ready…<span className="blink"> _</span>
    </p>
  );
}

function Status({ revealed, open, fixed, result }: Pick<Props, "revealed" | "open" | "fixed" | "result">) {
  const at = fixed && fixed.ms !== null ? ` at ${fmtElapsed(fixed.ms)}` : "";
  const box = "rounded-[10px] px-4 py-3";
  // A fix the server has, revealed before its points arrive, still reads as fixed.
  if (revealed)
    return (
      <div className={`${box} ${result || fixed ? "bg-meadow text-[#12332b]" : "bg-mist"}`} role="status">
        <p className="text-2xl font-extrabold">
          {result ? `Fixed! +${result.points}${result.first ? ", first to fix it" : ""}` : fixed ? `✓ Fixed${at}` : "Not fixed this time."}
        </p>
        {!result && <p className="font-semibold">{fixed ? "Points go up in a moment." : "The fix is under the task."}</p>}
      </div>
    );
  if (fixed)
    return (
      <div className={`${box} bg-meadow text-[#12332b]`} role="status">
        <p className="text-2xl font-extrabold">✓ Fixed{at}</p>
        <p className="font-semibold">Your fix counts. Points go up at the reveal.</p>
      </div>
    );
  if (!open)
    return (
      <p className={`${box} bg-mist text-xl font-bold`} role="status">
        Time’s up. Waiting for the reveal.
      </p>
    );
  return null;
}

const lines = (s: string) => s || "(nothing)";
// Inputs and outputs wrap (a long hash breaks anywhere) rather than scroll sideways.
const WRAP = "px-3 py-1.5 text-sm whitespace-pre-wrap wrap-anywhere";

function Examples({ tests }: { tests: FixTest[] }) {
  return (
    <div className="space-y-2">
      {tests.map((t, i) => (
        <div key={i} className="space-y-2 text-sm">
          <div>
            <p className="font-bold text-dim">{tests.length > 1 ? `Example ${i + 1} input` : "Example input"}</p>
            <InputLines input={t.input} />
          </div>
          <div>
            <p className="font-bold text-dim">Should print</p>
            <pre className={`code mt-1 ${WRAP}`}>{lines(t.output)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * What the program reads, each line labelled by its position in the input, so bare values like "3" and "2" read as what
 * gets typed in rather than as lines of code. The labels can't be selected, so copying takes just the input.
 */
function InputLines({ input }: { input: string }) {
  if (!input) return <pre className={`code mt-1 ${WRAP}`}>(no input)</pre>;
  const rows = input.split("\n");
  return (
    <pre className={`code mt-1 grid grid-cols-[minmax(0,auto)_max-content] justify-start gap-x-6 ${WRAP}`}>
      {rows.map((line, i) => (
        <Fragment key={i}>
          <span>{line || " "}</span>
          <span className="t-com select-none">
            ← input line {i + 1}
            {"\n"}
          </span>
        </Fragment>
      ))}
    </pre>
  );
}

/** What the editor is for, over it, with Reset at its corner (not beside Run, where it could be pressed by mistake). */
export function EditorHead({ note, onReset, changed }: { note: string; onReset: () => void; changed: boolean }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-2">
      <p className="font-bold">
        Your code <span className="font-normal text-dim @max-[30rem]:hidden">· {note}</span>
      </p>
      <button className="btn btn-sm shrink-0" onClick={onReset} disabled={!changed}>
        Reset code
      </button>
    </div>
  );
}

/** A plain editor: line numbers, Tab adds 4 spaces (Esc, then Tab, moves on). `mark` flags the line Python stopped on. */
export function Editor({
  value,
  onChange,
  fit,
  mark,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  fit?: string;
  mark?: number;
  className?: string;
}) {
  const n = value.split("\n").length;
  const escaped = useRef(false);
  return (
    <div
      className={`code flex p-0 focus-within:shadow-[inset_0_0_0_3px_var(--color-sun)] ${className}`}
      style={fit ? fitted(fit) : undefined}
    >
      <pre aria-hidden className="py-4 pr-3 pl-4 text-right text-[#7d9a92] select-none">
        {Array.from({ length: n }, (_, i) =>
          i + 1 === mark ? (
            <span key={i} className="-mr-3 block bg-signal pr-3 font-bold text-white">
              {i + 1}
            </span>
          ) : (
            <span key={i} className="block">
              {i + 1}
            </span>
          ),
        )}
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            escaped.current = true;
            return;
          }
          if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !escaped.current) {
            e.preventDefault();
            const t = e.currentTarget;
            t.setRangeText("    ", t.selectionStart, t.selectionEnd, "end");
            onChange(t.value);
          }
          escaped.current = false;
        }}
        rows={n}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label="Your program"
        className="min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent py-4 pr-4 outline-none"
      />
    </div>
  );
}

/**
 * A font size that shows every line of the starter code: its longest line fits the width of the nearest @container,
 * and on a laptop every row fits the height left under the bar, Run and Check. Never under 13px.
 */
function fitted(code: string) {
  const rows = code.split("\n");
  // Characters across: the longest line, the line numbers, and a spare one for the cursor. A mono character is 0.6em.
  const cols = Math.max(...rows.map((l) => l.length)) + String(rows.length).length + 1;
  return {
    fontSize: `clamp(13px, min((100cqw - 3rem) / ${cols * 0.6}, (100dvh - 15rem) / ${(rows.length + 1) * 1.5}), 18px)`,
    lineHeight: 1.5,
  };
}

/**
 * What Run or Check found, right under the buttons: one line that says how it went and what to do next (read out to
 * screen readers), then each example that went wrong, and hidden tests only as pass or fail, never their input or output.
 * Edited since? It says so, rather than passing off old results as the code's. Beside the task, the details scroll in a
 * box of their own under that line, so the editor above never moves.
 */
function Results({
  kind,
  list,
  planned,
  total,
  stale,
  fixed,
}: {
  kind: "run" | "check";
  list: TestResult[];
  planned: number;
  total: number;
  stale: boolean;
  fixed: boolean;
}) {
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // A new result starts at its top, and if its first line landed out of sight (a phone, where it all stacks), the page
  // brings it up under the bar. Beside the task it's already in view, so nothing moves.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    const el = head.current;
    if (!el) return;
    const top = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const r = el.getBoundingClientRect();
    if (r.top < top || r.bottom > innerHeight)
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [list]);
  const passed = list.filter((r) => r.pass).length;
  const examples = list.filter((r) => r.test.show);
  const hidden = list.filter((r) => !r.test.show);
  const crashed = list.some((r) => r.run.error || r.run.timedOut);
  const all = passed === list.length && list.length === planned;
  const summary =
    kind === "check"
      ? all
        ? fixed
          ? "Every test passes."
          : "Every test passes!"
        : `${passed} of ${total} tests pass.${crashed ? " Your program crashed on some." : ""}`
      : all
        ? `${examples.length === 1 ? "The example works" : "The examples work"}. Now Check my fix to run the hidden tests too.`
        : `${passed} of ${list.length} example${list.length === 1 ? "" : "s"} right.`;
  let ex = 0;
  let hid = 0;
  const details = !all && (examples.some((r) => !r.pass) || hidden.length > 0 || list.length < planned);
  return (
    <div className={`card flex flex-col px-4 py-3 ${details ? "shrink-[100] ws:min-h-[11rem]" : "shrink-0"} ${stale ? "opacity-70" : ""}`}>
      <div ref={head} className="shrink-0 scroll-mt-[calc(var(--ws-top,1rem)+0.5rem)]">
        <p role="status" className={`text-lg leading-snug font-extrabold ${all ? "text-pine" : ""}`}>
          <span className="mr-2 text-sm font-bold text-dim">{kind === "run" ? "Run" : "Check"} result</span>
          {all ? "✓ " : "✗ "}
          {summary}
        </p>
        {stale && <p className="text-sm font-semibold text-dim">You’ve changed the code since. Run it again to see the new result.</p>}
      </div>
      {details && (
        // A labelled stop in the tab order, so the keyboard can scroll it too.
        <div
          ref={body}
          role="region"
          aria-label={`${kind === "run" ? "Run" : "Check"} details`}
          tabIndex={0}
          className="-mx-1 mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 outline-offset-2"
        >
          {examples.map((r) => {
            const label = `Example ${++ex}`;
            if (r.pass)
              return (
                <p key={r.i} className="font-semibold">
                  ✓ {label} printed the right thing.
                </p>
              );
            const out = r.run.stdout.replace(/\n+$/, "");
            return (
              <div key={r.i} className="border-t border-line pt-2">
                {/* A crash: the error comes first, then what got printed before it, if anything (what it should print is
                    in the task, beside this). Otherwise, what it printed against what it should have. */}
                {r.run.error ? (
                  <>
                    <p className="font-bold">
                      ✗ {label} crashed{out ? "" : " before printing anything"}.
                    </p>
                    <Traceback text={r.run.error} />
                    {out && (
                      <div className="mt-2 text-sm">
                        <p className="font-bold text-dim">Before it crashed, it printed</p>
                        <pre className={`code mt-1 ${WRAP}`}>{out}</pre>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-bold">✗ {label}</p>
                    <div className="mt-1 grid gap-2 text-sm @min-[28rem]:grid-cols-2">
                      <div>
                        <p className="font-bold text-dim">Should print</p>
                        <pre className={`code mt-1 ${WRAP}`}>{lines(r.test.output)}</pre>
                      </div>
                      <div>
                        <p className="font-bold text-dim">Your program printed</p>
                        <pre className={`code mt-1 ${WRAP} shadow-[inset_4px_0_0_var(--color-signal)]`}>{lines(out)}</pre>
                      </div>
                    </div>
                  </>
                )}
                {r.run.timedOut && <p className="mt-2 font-semibold text-[#a8321f]">{TIMED_OUT}</p>}
              </div>
            );
          })}
          {hidden.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="font-bold">Hidden tests</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {hidden.map((r) => (
                  <li key={r.i} className="font-semibold">
                    {r.pass ? "✓" : "✗"} Test {++hid}
                    {!r.pass && <span className="font-normal text-dim">: {problem(r)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {list.length < planned && <p className="text-sm text-dim">The other tests didn’t run. Fix the loop, then try again.</p>}
        </div>
      )}
    </div>
  );
}

const TIMED_OUT = `Stopped after ${TIMEOUT_MS / 1000} seconds. Is there a loop that never ends?`;

/** Why a hidden test failed, without showing its input or output. */
function problem(r: TestResult) {
  if (r.run.timedOut) return "took too long";
  if (!r.run.error) return "wrong output";
  const name = /^([A-Za-z_][\w.]*)(?::|$)/.exec(lastLine(r.run.error))?.[1];
  return `crashed with ${name ?? "an error"}`;
}

const lastLine = (s: string) => s.trimEnd().split("\n").at(-1) ?? "";

/**
 * Brings a just-opened traceback into view inside the results box it's in, if that box scrolls: all of it if it fits,
 * else its top. Never the page, so the editor above stays where it is.
 */
function reveal(el: Element) {
  const box = el.closest("[role=region]");
  if (!box || box.scrollHeight <= box.clientHeight) return;
  const [r, b] = [el.getBoundingClientRect(), box.getBoundingClientRect()];
  const by = Math.min(r.bottom - b.bottom + 8, r.top - b.top);
  if (by > 0) box.scrollBy({ top: by });
}

/** The line of main.py a traceback ends on: where Python stopped. */
export const errorLine = (text: string) => {
  const at = [...text.matchAll(/File "main\.py", line (\d+)/g)].at(-1);
  return at ? Number(at[1]) : undefined;
};

/**
 * A crash, short enough to act on: what went wrong (Python's last line), the line it stopped on as Python showed it
 * (with its ^ marker for a syntax error), and the full traceback a click away, exactly as Python printed it.
 */
export function Traceback({ text }: { text: string }) {
  const all = text.trimEnd().split("\n");
  const line = errorLine(text);
  // What Python printed under the last main.py frame: the source line, and a ^ marker if it has one.
  const from = all.map((l) => l.includes('File "main.py"')).lastIndexOf(true);
  const excerpt = from === -1 ? [] : all.slice(from + 1, -1);
  const indent = Math.min(...excerpt.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return (
    <div className="mt-3 rounded-[6px] border-l-4 border-signal bg-signal/10 px-3 py-2.5">
      <p className="font-code font-bold break-words text-[#a8321f]">{all.at(-1)}</p>
      {line !== undefined && (
        <p className="mt-1 text-sm font-semibold">
          Python stopped on line {line}
          {excerpt.length > 0 ? ":" : "."}
        </p>
      )}
      {excerpt.length > 0 && (
        <pre className="code mt-1 px-3 py-1.5 text-sm">{excerpt.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n")}</pre>
      )}
      {all.length > 1 && (
        <details
          className="mt-1.5 text-sm"
          onToggle={(e) => e.currentTarget.open && e.currentTarget.lastElementChild && reveal(e.currentTarget.lastElementChild)}
        >
          <summary className="cursor-pointer py-1 font-semibold text-dim">Full traceback</summary>
          {/* Exactly as Python printed it, in a box of its own: a deep traceback scrolls rather than taking the screen. */}
          <pre tabIndex={0} aria-label="Full traceback" className="code mt-1 max-h-48 overflow-y-auto text-sm">
            {all.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

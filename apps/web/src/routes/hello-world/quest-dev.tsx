import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OfficerGate } from "#/components/officer";
import { Wrap } from "#/components/ui";
import { ITEMS, LEVELS, answerFor, check, levelFor } from "#/lib/quest";
import type { QuestItem } from "#/lib/quest";
import { CLUB } from "#/lib/season";

// Snow Quest's test bench: every terminal and secret on one page, outside a club night. It reads and writes the same
// practice save the game uses when no night is open (lib/quest-client.ts), so officers can check an answer here, mark
// things solved to open a zone, then walk into the game and find it that way. It shows every answer, so on the live
// site it is officers only; a development server opens it to anyone.
export const Route = createFileRoute("/hello-world/quest-dev")({
  head: () => ({ meta: [{ title: `Snow Quest test bench · ${CLUB.season}` }] }),
  component: QuestDev,
});

// The practice save, as lib/quest-client.ts keeps it.
const KEY = "hwc.quest.practice";
interface Practice {
  seed: number;
  claimed: string[];
  waits: Record<string, number>;
}
const fresh = (seed = Math.floor(Math.random() * 2 ** 32) >>> 0): Practice => ({ seed, claimed: [], waits: {} });

function load(): Practice {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Practice | null;
    if (p && typeof p.seed === "number" && Array.isArray(p.claimed)) return { ...p, waits: {} };
  } catch {
    // Storage blocked or a bad save: start fresh.
  }
  return fresh();
}

const xpOf = (claimed: string[]) => ITEMS.filter((i) => claimed.includes(i.key)).reduce((n, i) => n + i.xp, 0);
const pointsOf = (claimed: string[]) => {
  const xp = xpOf(claimed);
  const items = ITEMS.filter((i) => claimed.includes(i.key)).reduce((n, i) => n + i.points, 0);
  return items + LEVELS.filter((l) => l.xp > 0 && l.xp <= xp).reduce((n, l) => n + l.points, 0);
};

function QuestDev() {
  if (import.meta.env.DEV) return <Bench />;
  return (
    <Wrap className="py-10">
      <OfficerGate redirect="/hello-world/quest-dev" purpose="test Snow Quest">
        <Bench />
      </OfficerGate>
    </Wrap>
  );
}

function Bench() {
  const [save, setSave] = useState<Practice | null>(null);
  useEffect(() => setSave(load()), []);
  if (!save) return null;

  const write = (p: Practice) => {
    setSave(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // Storage blocked: the page still works, the game just won't see it.
    }
  };
  const toggle = (key: string) =>
    write({ ...save, claimed: save.claimed.includes(key) ? save.claimed.filter((k) => k !== key) : [...save.claimed, key] });
  const xp = xpOf(save.claimed);
  const level = levelFor(xp);

  return (
    <Wrap className="py-10">
      <h1 className="text-4xl lowercase">snow quest test bench</h1>
      <p className="mt-3 max-w-[70ch] text-dim">
        Every terminal and secret, with its answer, outside a club night. This page shares the game’s practice save: mark things solved
        here, then open the game and they are solved there. Nothing here earns Cup points.
      </p>

      <div className="card mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <p>
          Level <strong>{level}</strong> ({LEVELS.find((l) => l.level === level)?.title}) · <strong>{xp}</strong> xp ·{" "}
          <strong>{pointsOf(save.claimed)}</strong> points · {save.claimed.length} of {ITEMS.length} done
        </p>
        <label className="flex items-center gap-2 text-sm">
          Seed
          <input
            className="w-36 rounded border border-line bg-transparent px-2 py-1 font-mono"
            value={save.seed}
            inputMode="numeric"
            onChange={(e) => write({ ...save, seed: Number(e.target.value.replace(/\D/g, "")) >>> 0 })}
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn btn-sm btn-primary" href="/hello-world/quest">
            Open the game
          </a>
          <button className="btn btn-sm" onClick={() => write(fresh(save.seed))}>
            Reset progress
          </button>
          <button className="btn btn-sm" onClick={() => write(fresh())}>
            New seed
          </button>
          {[1, 2, 3, 4].map((z) => (
            <button
              key={z}
              className="btn btn-sm"
              title={`Mark everything before zone ${z} solved, and nothing after`}
              onClick={() => write({ ...save, claimed: ITEMS.filter((i) => i.zone < z).map((i) => i.key) })}
            >
              Start at zone {z}
            </button>
          ))}
          <button className="btn btn-sm" onClick={() => write({ ...save, claimed: ITEMS.map((i) => i.key) })}>
            Solve all
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm text-dim">
        Levels: {LEVELS.map((l) => `${l.level} at ${l.xp} xp${l.points ? ` (+${l.points} points)` : ""}`).join(" · ")}. Zone N needs level
        N. A night’s seed is different for every player, so answers to input puzzles differ too.
      </p>

      {[1, 2, 3, 4].map((zone) => (
        <section key={zone} className="mt-10">
          <h2 className="text-2xl lowercase">
            zone {zone} {level < zone && <span className="chip ml-2 align-middle text-sm">locked at level {level}</span>}
          </h2>
          <div className="mt-4 grid gap-4">
            {ITEMS.filter((i) => i.zone === zone).map((item) => (
              <ItemCard
                key={item.key}
                item={item}
                seed={save.seed}
                done={save.claimed.includes(item.key)}
                onToggle={() => toggle(item.key)}
              />
            ))}
          </div>
        </section>
      ))}
    </Wrap>
  );
}

const pre = "mt-2 max-h-64 overflow-auto rounded bg-ink/5 p-3 font-mono text-sm whitespace-pre-wrap";

function ItemCard({ item, seed, done, onToggle }: { item: QuestItem; seed: number; done: boolean; onToggle: () => void }) {
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);
  const input = item.input?.(seed);
  const want = answerFor(item.key, seed);
  const verdict = answer.trim() === "" ? null : check(item.key, seed, answer);

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-xl">{item.title}</h3>
        <span className="chip">{item.kind}</span>
        <code className="text-sm text-dim">{item.key}</code>
        <span className="text-sm text-dim">
          {item.xp} xp · {item.points} points
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={done} onChange={onToggle} /> Solved in practice
        </label>
      </div>

      {item.story && <p className="mt-3 whitespace-pre-wrap">{item.story}</p>}
      {item.question ? (
        <p className="mt-3 font-semibold whitespace-pre-wrap">{item.question}</p>
      ) : (
        <p className="mt-3 text-dim">Found by reaching it in the world. No answer to type.</p>
      )}
      {item.found && <p className="mt-2 text-sm text-dim">When found: {item.found}</p>}

      {input !== undefined && (
        <details className="mt-3" open={input.split("\n").length <= 8}>
          <summary className="cursor-pointer text-sm font-semibold">
            Input for this seed ({input.split("\n").length} lines){" "}
            <button
              className="btn btn-sm ml-2"
              onClick={(e) => {
                e.preventDefault();
                void navigator.clipboard.writeText(input);
              }}
            >
              Copy
            </button>
          </summary>
          <pre className={pre}>{input}</pre>
        </details>
      )}
      {item.example && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Example</summary>
          <pre className={pre}>{item.example.input}</pre>
          <p className="mt-2 text-sm">
            Answer: <code>{item.example.answer}</code>. {item.example.why}
          </p>
        </details>
      )}
      {item.hint && (
        <p className="mt-3 text-sm">
          <strong>Hint:</strong> {item.hint}
        </p>
      )}

      {item.question && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <input
            className="w-64 rounded border border-line bg-transparent px-3 py-1.5 font-mono"
            placeholder="Try an answer"
            aria-label={`Try an answer for ${item.title}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <span className="text-sm" role="status">
            {verdict === null ? "" : verdict ? "✓ Right" : "✗ Wrong"}
          </span>
          <button className="btn btn-sm ml-auto" onClick={() => setShown(!shown)}>
            {shown ? "Hide answer" : "Show answer"}
          </button>
          {shown && <code className="rounded bg-ink/5 px-2 py-1">{want}</code>}
        </div>
      )}
    </article>
  );
}

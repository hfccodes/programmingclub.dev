// Small shared pieces of Snow Quest's overlay look: keycaps, the framed panel, code with warm syntax colours, and
// question text. Styles live in quest-ui.css.
import { useState } from "react";
import type { ReactNode } from "react";
import { ROOMS } from "../world";
import "./quest-ui.css";

export const ART = "/quest/art";

/** A zone's name: the first room painted for it. */
export const zoneName = (z: number) => ROOMS.find((r) => r.zone === z)?.name ?? `Zone ${z}`;

export const Key = ({ children, gold }: { children: ReactNode; gold?: boolean }) => (
  <kbd className={`qx-key${gold ? " on-gold" : ""}`}>{children}</kbd>
);

/** An image that quietly disappears if the file isn't there. */
export function Art({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback?: ReactNode }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} onError={() => setOk(false)} />;
}

/** The game's panel frame: layered night, a gold rim, and brass corners. */
export function Studs() {
  return (
    <>
      <i className="qx-stud tl" aria-hidden />
      <i className="qx-stud tr" aria-hidden />
      <i className="qx-stud bl" aria-hidden />
      <i className="qx-stud br" aria-hidden />
    </>
  );
}

/** Text with `backticks` shown as code. */
export const Rich = ({ text }: { text: string }) => (
  <>
    {text.split("`").map((part, i) =>
      i % 2 ? (
        <code key={i} className="qx-code-inline">
          {part}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

const KW = new Set(
  "and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield".split(
    " ",
  ),
);
const TOKEN =
  /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|([+\-*/%=<>!]=?|\/\/|\*\*)/g;

/** Python with warm colours: keywords coral, strings gold, numbers lilac, calls ice, comments a quiet blue. */
export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index;
    if (i > at) out.push(code.slice(at, i));
    const [t, com, str, num, fn, word, op] = m;
    const cls = com
      ? "s-com"
      : str
        ? "s-str"
        : num
          ? "s-num"
          : fn
            ? KW.has(fn)
              ? "s-kw"
              : "s-fn"
            : word
              ? KW.has(word)
                ? "s-kw"
                : ""
              : op
                ? "s-op"
                : "";
    out.push(
      cls ? (
        <span key={k++} className={cls}>
          {t}
        </span>
      ) : (
        t
      ),
    );
    at = i + t.length;
  }
  if (at < code.length) out.push(code.slice(at));
  return out;
}

export const Code = ({ code, className = "" }: { code: string; className?: string }) => (
  <pre className={`qx-code ${className}`}>{highlight(code)}</pre>
);

/** Question text: plain lines with `code`, and lines indented 4 spaces shown as a code block. */
export function QText({ text, onCode }: { text: string; onCode?: (code: string) => void }) {
  const blocks: { code: boolean; lines: string[] }[] = [];
  for (const l of text.split("\n")) {
    const code = l.startsWith("    ");
    const last = blocks.at(-1);
    if (last && last.code === code) last.lines.push(code ? l.slice(4) : l);
    else blocks.push({ code, lines: [code ? l.slice(4) : l] });
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.code ? (
          <div key={i} className="qx-codewrap">
            <Code code={b.lines.join("\n")} />
            {onCode && (
              <button className="qx-quiet qx-code-send" onClick={() => onCode(b.lines.join("\n"))}>
                ›_ Put this in the Python box
              </button>
            )}
          </div>
        ) : !b.lines.join("").trim() ? null : (
          <p key={i} className="whitespace-pre-wrap">
            <Rich text={b.lines.join("\n").trim()} />
          </p>
        ),
      )}
    </>
  );
}

export const Chevron = () => (
  <span className="chev" aria-hidden>
    <svg width="12" height="12" viewBox="0 0 12 12">
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export const CopyIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M11 3.5V3a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 2 3v6a1.5 1.5 0 0 0 1.5 1.5H4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);
export const DownloadIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path
      d="M8 2v8m0 0L4.8 6.8M8 10l3.2-3.2M2.5 11.5v1A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5v-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A little burst of stars for a reward. */
export function Sparks({ n = 14 }: { n?: number }) {
  return (
    <div className="qx-sparks" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = 90 + (i % 3) * 50;
        return (
          <i
            key={i}
            style={
              {
                left: `${20 + ((i * 37) % 60)}%`,
                top: `${30 + ((i * 53) % 40)}%`,
                "--dx": `${Math.cos(a) * r}px`,
                "--dy": `${Math.sin(a) * r * 0.6}px`,
                animationDelay: `${(i % 5) * 0.06}s`,
                background: i % 3 ? "#fff" : "#ffe7a8",
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

// Python-friendly keys for a plain textarea: Enter keeps (and after a colon, adds) indentation, Tab and Shift+Tab
// move lines in and out by 4 spaces, Backspace removes a whole indent level, brackets and quotes pair up, Home goes to
// the first character, Ctrl+/ comments lines. Edits go through execCommand("insertText"), so Ctrl+Z still works.

type Area = HTMLTextAreaElement;

const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
const CLOSERS = new Set([")", "]", "}"]);

const lineStart = (v: string, pos: number) => v.lastIndexOf("\n", pos - 1) + 1;
const lineEnd = (v: string, pos: number) => {
  const i = v.indexOf("\n", pos);
  return i === -1 ? v.length : i;
};
const indentOf = (line: string) => /^ */.exec(line)?.[0].length ?? 0;

/** Replaces [start, end) with text, keeping the browser's undo history, then sets the selection. */
export function replaceText(t: Area, start: number, end: number, text: string, selA?: number, selB?: number) {
  t.focus();
  t.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = text === "" ? start === end || document.execCommand("delete") : document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    t.setRangeText(text, start, end, "end");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (selA !== undefined) t.setSelectionRange(selA, selB ?? selA);
}

/** The whole lines a selection touches (a selection ending at a line's very start doesn't take that line). */
function block(v: string, a: number, b: number) {
  const s = lineStart(v, a);
  const endAt = b > a && v[b - 1] === "\n" ? b - 1 : b;
  return { s, e: lineEnd(v, endAt) };
}

/** Handles one keydown. Returns true when it took the key (the caller then prevents the default). */
export function pyKey(e: KeyboardEvent | React.KeyboardEvent<Area>, t: Area, onRun?: () => void): boolean {
  const v = t.value;
  const a = t.selectionStart;
  const b = t.selectionEnd;
  const mod = e.ctrlKey || e.metaKey;
  const ls = lineStart(v, a);

  if (mod && e.key === "Enter") {
    onRun?.();
    return true;
  }
  if (mod && e.key === "/") {
    const { s, e: end } = block(v, a, b);
    const lines = v.slice(s, end).split("\n");
    const filled = lines.filter((l) => l.trim());
    const all = filled.length > 0 && filled.every((l) => l.trimStart().startsWith("#"));
    const min = Math.min(...filled.map(indentOf));
    const out = lines.map((l) => {
      if (!l.trim()) return l;
      if (all) return l.replace(/^( *)# ?/, "$1");
      return l.slice(0, min) + "# " + l.slice(min);
    });
    const text = out.join("\n");
    if (a === b) replaceText(t, s, end, text, Math.max(s, a + text.length - (end - s)));
    else replaceText(t, s, end, text, s, s + text.length);
    return true;
  }
  if (mod || e.altKey) return false;

  if (e.key === "Enter") {
    const line = v.slice(ls, a);
    const ind = indentOf(line);
    const code = line.replace(/#.*$/, "").trimEnd();
    let next = ind;
    if (!line.trim()) next = line.length;
    else if (code.endsWith(":")) next = ind + 4;
    else if (/^\s*(return|break|continue|pass|raise)\b/.test(line)) next = Math.max(0, ind - 4);
    const text = "\n" + " ".repeat(next);
    replaceText(t, a, b, text, a + text.length);
    return true;
  }

  if (e.key === "Tab") {
    if (e.shiftKey) {
      const { s, e: end } = block(v, a, b);
      const lines = v.slice(s, end).split("\n");
      const cut = lines.map((l) => Math.min(4, indentOf(l)));
      if (cut.every((c) => c === 0)) return true;
      const text = lines.map((l, i) => l.slice(cut[i])).join("\n");
      if (a === b) replaceText(t, s, end, text, Math.max(s, a - cut[0]));
      else replaceText(t, s, end, text, s, s + text.length);
      return true;
    }
    if (a !== b && v.slice(a, b).includes("\n")) {
      const { s, e: end } = block(v, a, b);
      const text = v
        .slice(s, end)
        .split("\n")
        .map((l) => (l.trim() ? "    " + l : l))
        .join("\n");
      replaceText(t, s, end, text, s, s + text.length);
      return true;
    }
    const n = 4 - ((a - ls) % 4);
    replaceText(t, a, b, " ".repeat(n), a + n);
    return true;
  }

  if (e.key === "Backspace" && a === b && a > 0) {
    const prev = v[a - 1];
    if (PAIRS[prev] && v[a] === PAIRS[prev]) {
      replaceText(t, a - 1, a + 1, "", a - 1);
      return true;
    }
    const before = v.slice(ls, a);
    if (before.length > 0 && /^ +$/.test(before)) {
      const k = before.length % 4 || 4;
      replaceText(t, a - k, a, "", a - k);
      return true;
    }
    return false;
  }

  if (e.key === "Home" && !e.shiftKey) {
    const first = ls + indentOf(v.slice(ls, lineEnd(v, ls)));
    t.setSelectionRange(a === first ? ls : first, a === first ? ls : first);
    return true;
  }

  if (CLOSERS.has(e.key) && a === b && v[a] === e.key) {
    t.setSelectionRange(a + 1, a + 1);
    return true;
  }

  const close = PAIRS[e.key] as string | undefined;
  if (close) {
    if (a !== b && !v.slice(a, b).includes("\n")) {
      replaceText(t, a, b, e.key + v.slice(a, b) + close, a + 1, b + 1);
      return true;
    }
    if (a !== b) return false;
    const next = v[a] as string | undefined;
    const prev = v[a - 1] as string | undefined;
    const quote = e.key === '"' || e.key === "'";
    if (quote && next === e.key) {
      t.setSelectionRange(a + 1, a + 1);
      return true;
    }
    if (quote && prev && /\w/.test(prev)) return false;
    if (next === undefined || /\s/.test(next) || CLOSERS.has(next) || next === ":" || next === ",") {
      replaceText(t, a, a, e.key + close, a + 1);
      return true;
    }
  }
  return false;
}

/** Pasted code: tabs become 4 spaces and Windows line ends go, so indentation never mixes. Returns true if handled. */
export function pyPaste(e: React.ClipboardEvent<Area>) {
  const text = e.clipboardData.getData("text/plain");
  if (!/[\t\r]/.test(text)) return false;
  const t = e.currentTarget;
  const clean = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  replaceText(t, t.selectionStart, t.selectionEnd, clean, t.selectionStart + clean.length);
  return true;
}

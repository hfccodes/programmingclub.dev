// Desktop search: Ctrl+K (⌘K), /, or the taskbar's Search button. Finds the desktop's apps and every Learn to Code resource;
// Enter opens an app's window or a resource in a new tab.
import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { InstagramGlyph } from "#/components/instagram";
import { useLikelyOfficer } from "#/components/officer";
import { RESOURCES } from "#/lib/learn";
import { CLUB, INSTAGRAM_URL } from "#/lib/season";
import { APPS } from "./apps";
import type { App } from "./apps";

type Item = {
  key: string;
  title: string;
  sub: string;
  group: "Apps" | "Learn to code";
  glyph: ReactNode;
  /** Lowercased text a query has to match. */
  words: string;
} & ({ app: App } | { href: string });

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

function useItems(): Item[] {
  const officer = useLikelyOfficer();
  return useMemo(
    () => [
      ...APPS.filter((a) => !a.officer || officer).map((a): Item => ({
        key: a.id,
        title: a.label,
        sub: a.title === a.label ? "Open window" : a.title,
        group: "Apps",
        glyph: a.glyph,
        words: `${a.label} ${a.title} ${a.path.replace(/[/-]/g, " ")}`.toLowerCase(),
        app: a,
      })),
      {
        key: "instagram",
        title: "Instagram",
        sub: `@${CLUB.instagram}`,
        group: "Apps",
        glyph: <InstagramGlyph className="size-full" />,
        words: `instagram photos ${CLUB.instagram}`,
        href: INSTAGRAM_URL,
      },
      ...RESOURCES.map((r): Item => ({
        key: r.url,
        title: r.name,
        sub: `${r.stage} · ${r.price}`,
        group: "Learn to code",
        glyph: ARROW,
        words: `${r.name} ${r.blurb} ${r.tags ?? ""} ${r.price}`.toLowerCase(),
        href: r.url,
      })),
    ],
    [officer],
  );
}

/** Every word of the query has to appear; names that start with it come first. */
function search(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.filter((i) => i.group === "Apps");
  const terms = q.split(/\s+/);
  const rank = (i: Item) => (i.title.toLowerCase().startsWith(q) ? 0 : i.title.toLowerCase().includes(q) ? 1 : 2);
  return items
    .filter((i) => terms.every((t) => i.words.includes(t) || i.title.toLowerCase().includes(t)))
    .sort((a, b) => rank(a) - rank(b));
}

export function Launcher({
  open,
  onOpenChange,
  onOpen,
  container,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpen: (a: App) => void;
  container: RefObject<HTMLDivElement | null>;
}) {
  const items = useItems();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(items, query), [items, query]);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onOpenChange(false);
    if ("app" in item) onOpen(item.app);
    else window.open(item.href, "_blank", "noopener,noreferrer");
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = results.length;
    if (!n) return;
    if (e.key === "ArrowDown") setActive((a) => (a + 1) % n);
    else if (e.key === "ArrowUp") setActive((a) => (a - 1 + n) % n);
    else if (e.key === "Home" && e.ctrlKey) setActive(0);
    else if (e.key === "End" && e.ctrlKey) setActive(n - 1);
    else if (e.key === "Enter") choose(results[active]);
    else return;
    e.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="launcher-backdrop fixed inset-0 z-[60] bg-[#020c20]/35" />
        <Dialog.Popup
          aria-label="Search the desktop"
          className="win launcher-open fixed top-[max(1rem,12vh)] left-1/2 z-[61] flex max-h-[min(34rem,calc(100dvh-6rem))] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 flex-col outline-none"
        >
          <Dialog.Title className="sr-only">Search the desktop</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-dim" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
              aria-label="Search apps and places to learn"
              placeholder="Search apps and places to learn…"
              className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-dim/70"
            />
            <kbd className="rounded-[6px] bg-mist px-1.5 py-0.5 text-xs font-semibold text-dim max-sm:hidden">Esc</kbd>
          </div>
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.map((item, i) => (
              <li key={item.key} role="presentation">
                {(i === 0 || results[i - 1].group !== item.group) && (
                  <p className="px-2 pt-2 pb-1 text-xs font-bold tracking-wide text-dim uppercase" aria-hidden>
                    {item.group}
                  </p>
                )}
                <div
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => choose(item)}
                  className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-2 py-1.5 ${i === active ? "bg-mist" : ""}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-[8px] p-1.5 ${"app" in item ? "bg-[#0b4fa3] text-white" : "bg-mist text-dim shadow-[0_0_0_1px_var(--color-line)]"}`}
                  >
                    {item.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.title}</span>
                    <span className="block truncate text-sm text-dim">{item.sub}</span>
                  </span>
                  {i === active && (
                    <kbd className="text-xs font-semibold text-dim max-sm:hidden" aria-hidden>
                      {"app" in item ? "Open ↵" : "New tab ↵"}
                    </kbd>
                  )}
                </div>
              </li>
            ))}
            {!results.length && (
              <li className="px-3 py-8 text-center text-dim" role="presentation">
                Nothing matches “{query.trim()}”.
              </li>
            )}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The taskbar's Search button, with its shortcut on wide screens. */
export function SearchButton({ onClick }: { onClick: () => void }) {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌘");
  }, []);
  return (
    <button
      onClick={onClick}
      aria-label="Search"
      aria-keyshortcuts="Control+K Meta+K /"
      className="press flex h-9 shrink-0 items-center gap-2 rounded-[8px] px-2.5 text-sm text-white/85 hover:bg-white/12 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" strokeLinecap="round" />
      </svg>
      <span className="max-lg:hidden">Search</span>
      <kbd className="rounded-[5px] bg-white/12 px-1.5 text-xs font-semibold text-white/75 max-lg:hidden">{mod} K</kbd>
    </button>
  );
}

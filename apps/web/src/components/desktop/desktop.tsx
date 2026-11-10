// The club home page as a lab-computer desktop: icons open draggable windows, a taskbar shows the clock and the next meeting.
// Every window has its own address (/about, /meetings, …) so links, search, and the back button work.
// Phones get a home screen of app icons, and each app opens full screen.
import { Menu } from "@base-ui/react/menu";
import { Show, SignInButton, UserButton } from "@clerk/tanstack-react-start";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject, PointerEvent as ReactPointerEvent } from "react";
import { InstagramGlyph, InstagramLink } from "#/components/instagram";
import { useLikelyOfficer } from "#/components/officer";
import { ClubLogo } from "#/components/site";
import { nextMeeting, useSchedule } from "#/lib/schedule";
import { CLUB, INSTAGRAM_URL, isHalloweenMonth, isWinter } from "#/lib/season";
import { Ambient } from "./ambient";
import { APPS, appFor, countdown } from "./apps";
import { Launcher, SearchButton } from "./launcher";
import { Scene } from "./scene";
import { SpookyScene } from "./spooky-scene";
import { Lights, Snow } from "#/components/winter";
import type { App, AppId } from "./apps";

type Pt = { x: number; y: number };
/** Windows animate between states; the state only changes once the animation ends. */
type Phase = "opening" | "closing" | "minimizing" | "restoring" | "zooming";
/**
 * Array order is stacking order; `n` is opening order, which the taskbar keeps. `delay` holds the first windows until startup finishes.
 * `tile` places the two startup windows side by side (0 left, 1 right) instead of at their usual spots, where they'd overlap.
 */
type Win = {
  id: AppId;
  n: number;
  pos?: Pt;
  min?: boolean;
  max?: boolean;
  phase?: Phase;
  fly?: Pt;
  delay?: number;
  tile?: 0 | 1;
  /** Docked to half the screen by dragging it to a side edge. */
  snap?: Snap;
  /** Set once the window has been resized by an edge or corner, in pixels. */
  size?: { w: number; h: number };
};
type Snap = "left" | "right";
let opened = 0;
/** The startup animation plays on the first load only, not when coming back from another page. Set in an effect, so never on the server. */
let booted = false;

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bring a window to the front, un-minimizing it (with the restore animation) if needed. */
function raise(ws: Win[], id: AppId): Win[] {
  const w = ws.find((x) => x.id === id);
  const next: Win = !w
    ? { id, n: ++opened, phase: "opening" }
    : w.min
      ? { ...w, min: false, phase: still() ? undefined : "restoring" }
      : { ...w, phase: w.phase === "closing" ? undefined : w.phase };
  return [...ws.filter((x) => x.id !== id), next];
}

/** How far a window has to travel to land on its taskbar button. */
function flyTo(id: AppId): Pt | undefined {
  const win = document.querySelector(`[data-win="${id}"]`)?.getBoundingClientRect();
  const btn = document.querySelector(`[data-task="${id}"]`)?.getBoundingClientRect();
  if (!win || !btn) return;
  return { x: btn.left + btn.width / 2 - (win.left + win.width / 2), y: btn.top + btn.height / 2 - (win.top + win.height / 2) };
}

/** Desktop and phone icons: everything but the footer-linked "About this site", plus officer apps for officers. */
const useIconApps = () => {
  const officer = useLikelyOfficer();
  return APPS.filter((a) => a.id !== "site" && (!a.officer || officer));
};

const SITE = APPS.find((a) => a.id === "site")!;

function Icon({ app, size = "md" }: { app: App; size?: "md" | "lg" }) {
  return <span className={`desk-icon shrink-0 ${size === "lg" ? "size-16 p-4" : "size-14 p-3.5"}`}>{app.glyph}</span>;
}

export function Desktop() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const routeApp = appFor(path);
  const [boot] = useState(() => !booted);
  useEffect(() => {
    booted = true;
  }, []);
  const [wins, setWins] = useState<Win[]>(() =>
    (routeApp ? [routeApp.id] : (["meetings", "about"] as const)).map((id, i) => ({
      id,
      n: ++opened,
      phase: "opening",
      delay: boot ? 700 + i * 120 : 0,
      tile: routeApp ? undefined : id === "about" ? 0 : 1,
    })),
  );
  // Too narrow to tile the startup pair: keep Meetings in the taskbar rather than under welcome.txt.
  useLayoutEffect(() => {
    if (matchMedia("(max-width: 56rem)").matches)
      setWins((ws) => ws.map((w) => (w.tile === 1 ? { ...w, min: true, phase: undefined } : w)));
  }, []);
  const [startOpen, setStartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const iconApps = useIconApps();
  const october = isHalloweenMonth();
  const winter = isWinter();
  // Startup stagger: each icon (and the "About this site" card after them) waits for the one before.
  const bootIn: BootIn = (i) =>
    boot ? { className: "boot-icon", style: { "--i": i } as CSSProperties } : { className: "", style: undefined };

  // Opening a window's address opens (or raises) that window.
  useEffect(() => {
    if (!routeApp) return;
    setWins((ws) => {
      const top = ws.at(-1);
      if (top?.id === routeApp.id && !top.min && top.phase !== "closing") return ws;
      return raise(ws, routeApp.id);
    });
  }, [routeApp]);

  const go = useCallback((to: string, replace = false) => void navigate({ to, replace }), [navigate]);
  const open = (app: App) => {
    setStartOpen(false);
    go(app.path);
  };
  const focus = (id: AppId) => {
    const app = APPS.find((a) => a.id === id)!;
    if (path !== app.path) go(app.path, true);
    setWins((ws) => raise(ws, id));
  };
  const patch = (id: AppId, p: Partial<Win>) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)));
  // After closing or minimizing, the address follows the window that's now on top.
  const leave = (id: AppId) => {
    const top = [...wins].reverse().find((w) => w.id !== id && !w.min && w.phase !== "closing");
    go(top ? APPS.find((a) => a.id === top.id)!.path : "/", true);
  };
  const close = (id: AppId) => {
    if (still()) setWins((ws) => ws.filter((w) => w.id !== id));
    else patch(id, { phase: "closing" });
    leave(id);
  };
  const minimize = (id: AppId) => {
    const fly = still() ? undefined : flyTo(id);
    patch(id, fly ? { phase: "minimizing", fly } : { min: true, phase: undefined });
    leave(id);
  };
  // A window docked to a side restores to where it was; otherwise this toggles full screen.
  const maximize = (id: AppId) => {
    const w = wins.find((x) => x.id === id);
    const phase = still() ? undefined : ("zooming" as const);
    patch(id, w?.snap ? { snap: undefined, phase } : { max: !w?.max, phase });
  };
  const settle = (id: AppId) =>
    setWins((ws) =>
      ws.flatMap((w) => {
        if (w.id !== id) return [w];
        if (w.phase === "closing") return [];
        if (w.phase === "minimizing") return [{ ...w, min: true, phase: undefined }];
        return [{ ...w, phase: undefined }];
      }),
    );

  // Ctrl+K (⌘K on a Mac), or / outside a text field, opens search.
  // Escape closes the window on top, unless something else (like the Start menu) already handled it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setStartOpen(false);
        setSearchOpen(true);
        return;
      }
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const top = [...wins].reverse().find((w) => !w.min && w.phase !== "closing");
      if (top && !(e.target as HTMLElement).closest("input, textarea")) close(top.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = wins.filter((w) => !w.min);
  const topId = visible.filter((w) => w.phase !== "closing").at(-1)?.id;

  return (
    <div ref={root} className="theme-club desk-wallpaper fixed inset-0 overflow-hidden text-ink" data-october={october || undefined}>
      <div aria-hidden className={`absolute inset-0 ${boot ? "boot-wallpaper" : ""}`}>
        <div className="desk-aerial" />
        {october ? <SpookyScene /> : <Scene />}
        <Ambient root={root} parallax={!october} />
        {/* Winter: snow over the shore and lights along the top. Reduced motion stills both. */}
        {winter && (
          <div className="absolute inset-0 [--bulb:0.65rem] [--lights-h:2.6rem] [--snow-unit:0.5vmax] [--wire:#081833]">
            <Snow count={90} />
            <Lights swags={4} className="md:hidden" />
            <Lights swags={9} per={5} className="max-md:hidden" />
          </div>
        )}
      </div>

      {/* Desktop (tablets and up) */}
      <div data-windows className="absolute inset-0 bottom-12 max-md:hidden">
        {/* Icons fill a column, then wrap into the next one on short screens. */}
        <nav aria-label="Desktop" className="absolute top-6 left-4 flex h-[calc(100%-7.5rem)] flex-col flex-wrap content-start gap-1">
          {iconApps.map((app, i) => (
            <button
              key={app.id}
              onClick={() => open(app)}
              style={bootIn(i).style}
              className={`group press flex w-28 flex-col items-center gap-2 rounded-[12px] p-2 text-center outline-none ${bootIn(i).className}`}
            >
              <Icon app={app} />
              <span className="rounded-[4px] px-1.5 py-0.5 text-[0.8rem] leading-tight font-semibold text-white [text-shadow:0_1px_2px_rgb(2_12_32/0.6)] group-focus-visible:bg-[#1f63d6]">
                {app.label}
              </span>
            </button>
          ))}
        </nav>

        <a
          href="/site"
          onClick={(e) => {
            e.preventDefault();
            open(SITE);
          }}
          style={bootIn(iconApps.length).style}
          className={`glass absolute bottom-5 left-5 flex max-w-xs items-center gap-3 rounded-[12px] p-2 pr-4 text-xs leading-snug ${bootIn(iconApps.length).className}`}
        >
          <span className="desk-icon size-9 shrink-0 rounded-[8px] p-2">{SITE.glyph}</span>
          <span className="text-white/80">
            Not an official Henry Ford College site.
            <span className="block font-semibold text-white underline decoration-white/40 underline-offset-2">About this site</span>
          </span>
        </a>

        {/* Rendered in opening order, stacked by z-index: moving a window's element to the end of the list to raise it
            would drop the pointer capture of a drag that starts on a window behind another. */}
        {[...visible]
          .sort((a, b) => a.n - b.n)
          .map((w) => {
            const app = APPS.find((a) => a.id === w.id)!;
            return (
              <Window
                key={w.id}
                app={app}
                win={w}
                z={10 + visible.indexOf(w)}
                active={w.id === topId}
                onFocus={() => focus(w.id)}
                onClose={() => close(w.id)}
                onMinimize={() => minimize(w.id)}
                onMaximize={() => maximize(w.id)}
                onPatch={(p) => patch(w.id, p)}
                onSettle={() => settle(w.id)}
              />
            );
          })}
      </div>

      {/* Phone home screen, or the open app full screen */}
      <Phone routeApp={routeApp} onOpen={open} bootIn={bootIn} />

      <Taskbar
        wins={wins.filter((w) => w.phase !== "closing").sort((a, b) => a.n - b.n)}
        topId={topId}
        startOpen={startOpen}
        setStartOpen={setStartOpen}
        onOpen={open}
        onFocus={focus}
        onMinimize={minimize}
        inApp={!!routeApp}
        boot={boot}
        menuRoot={root}
        onSearch={() => setSearchOpen(true)}
      />
      <Launcher open={searchOpen} onOpenChange={setSearchOpen} onOpen={open} container={root} />
    </div>
  );
}

// Two equal windows centered in the space right of the icons, 1rem apart. On narrow screens they shrink to 19rem,
// then the right one slides left over the first rather than off the edge.
const TILE_W = "min(28rem, max(19rem, (100% - 18rem) / 2))";
const TILE_X = `16rem + max(0rem, (100% - 18rem - 2 * ${TILE_W}) / 2)`;
const tiled = (i: 0 | 1): CSSProperties => ({
  left: i ? `min(${TILE_X} + ${TILE_W} + 1rem, 100% - ${TILE_W} - 1rem)` : `calc(${TILE_X})`,
  top: "1.5rem",
  width: TILE_W,
  maxHeight: "calc(100% - 2.5rem)",
});

/** A CSS length in rem (like an app's width) in pixels. */
const remPx = (len: string) => parseFloat(len) * parseFloat(getComputedStyle(document.documentElement).fontSize);

/** Docked windows float this far off the edges and each other, like a tiling window manager's gaps. */
const GAP = 10;
/** How close to the desktop's edge the pointer has to be to dock a window there. */
const EDGE = 6;
/** How far the pointer moves before a docked window tears off, so a double-click still restores it. */
const TEAR = 6;

/** `loose` once the window moves freely; `torn` for the one move that tears a docked window off. */
type Drag = { dx: number; dy: number; x0: number; y0: number; origin: Pt; loose: boolean; torn?: boolean };
/** Which edges a resize handle moves: e(ast), w(est), s(outh). */
type Edges = "e" | "w" | "s" | "se" | "sw";
type Resize = { x0: number; y0: number; w0: number; h0: number; left: number; top: number; edges: Edges };

function Window({
  app,
  win,
  z,
  active,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onPatch,
  onSettle,
}: {
  app: App;
  win: Win;
  z: number;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onPatch: (p: Partial<Win>) => void;
  onSettle: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const resize = useRef<Resize | null>(null);
  // Where the window would dock if it were let go now, previewed under it.
  const [hint, setHint] = useState<Snap | "max" | null>(null);
  const docked = !!(win.max || win.snap);

  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current!;
    drag.current = {
      dx: e.clientX - el.offsetLeft,
      dy: e.clientY - el.offsetTop,
      x0: e.clientX,
      y0: e.clientY,
      origin: { x: el.offsetLeft, y: el.offsetTop },
      loose: !docked,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onFocus();
  };
  const onDrag = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = ref.current!;
    const parent = el.offsetParent as HTMLElement;
    let width = el.offsetWidth;
    if (!d.loose) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < TEAR) return;
      // Tear a docked window off: back to its own size, with the same spot of the title bar under the pointer.
      const rect = el.getBoundingClientRect();
      width = Math.min(win.size?.w ?? remPx(app.width), parent.clientWidth - 32);
      d.dx = ((d.x0 - rect.left) / rect.width) * width;
      d.dy = d.y0 - rect.top;
      d.loose = d.torn = true;
    }
    // Keep the title bar on screen.
    const x = Math.min(Math.max(e.clientX - d.dx, -width + 120), parent.clientWidth - 120);
    const y = Math.min(Math.max(e.clientY - d.dy, 0), parent.clientHeight - 44);
    if (d.torn) {
      d.origin = { x, y };
      d.torn = false;
    }
    onPatch({ pos: { x, y }, ...(docked ? { max: false, snap: undefined } : {}) });
    const next = e.clientY <= EDGE ? "max" : e.clientX <= EDGE ? "left" : e.clientX >= parent.clientWidth - EDGE ? "right" : null;
    if (next !== hint) setHint(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!hint) return;
    setHint(null);
    if (!d?.loose) return;
    // Docked windows keep where they were picked up from, to go back to when restored.
    const phase = still() ? undefined : ("zooming" as const);
    onPatch(hint === "max" ? { max: true, pos: d.origin, phase } : { snap: hint, pos: d.origin, phase });
  };

  const onResizeDown = (edges: Edges) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    const el = ref.current!;
    resize.current = {
      x0: e.clientX,
      y0: e.clientY,
      w0: el.offsetWidth,
      h0: el.offsetHeight,
      left: el.offsetLeft,
      top: el.offsetTop,
      edges,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onFocus();
  };
  const onResize = (e: ReactPointerEvent) => {
    const r = resize.current;
    if (!r) return;
    const parent = ref.current!.offsetParent as HTMLElement;
    const minW = remPx("18rem");
    const minH = remPx("12rem");
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    let { w0: w, h0: h, left: x } = r;
    if (r.edges.includes("e")) w = clamp(r.w0 + e.clientX - r.x0, minW, parent.clientWidth - r.left);
    if (r.edges.includes("w")) {
      w = clamp(r.w0 - (e.clientX - r.x0), minW, r.left + r.w0);
      x = r.left + r.w0 - w;
    }
    if (r.edges.includes("s")) h = clamp(r.h0 + e.clientY - r.y0, minH, parent.clientHeight - r.top);
    onPatch({ pos: { x, y: r.top }, size: { w, h } });
  };
  const resizeHandle = (edges: Edges, className: string) => (
    <span
      aria-hidden
      onPointerDown={onResizeDown(edges)}
      onPointerMove={onResize}
      onPointerUp={() => (resize.current = null)}
      onPointerCancel={() => (resize.current = null)}
      className={`absolute z-10 touch-none ${className}`}
    />
  );

  const place: CSSProperties = win.max
    ? { left: GAP, top: GAP, width: `calc(100% - ${2 * GAP}px)`, height: `calc(100% - ${2 * GAP}px)` }
    : win.snap
      ? {
          left: win.snap === "left" ? GAP : `calc(50% + ${GAP / 2}px)`,
          top: GAP,
          width: `calc(50% - ${GAP * 1.5}px)`,
          height: `calc(100% - ${2 * GAP}px)`,
        }
      : win.pos
        ? {
            left: win.pos.x,
            top: win.pos.y,
            width: win.size ? win.size.w : app.width,
            height: win.size?.h,
            maxHeight: win.size ? `calc(100% - ${win.pos.y}px)` : `calc(100% - ${win.pos.y}px - 1rem)`,
          }
        : win.tile !== undefined
          ? tiled(win.tile)
          : // Clear the icon columns (two once officers see the Dashboard) so a fresh window never covers them.
            {
              left: `max(16rem, ${app.at.left}%)`,
              top: `${app.at.top}%`,
              width: app.width,
              maxHeight: `calc(${100 - app.at.top}% - 1rem)`,
            };
  const fly = win.fly ? { "--fx": `${win.fly.x}px`, "--fy": `${win.fly.y}px` } : {};

  return (
    <>
      {hint && (
        <div
          aria-hidden
          className="snap-hint pointer-events-none absolute"
          style={{
            zIndex: z - 1,
            inset: GAP,
            left: hint === "right" ? `calc(50% + ${GAP / 2}px)` : GAP,
            right: hint === "left" ? `calc(50% + ${GAP / 2}px)` : GAP,
          }}
        />
      )}
      <section
        ref={ref}
        role="dialog"
        aria-label={app.title}
        data-win={app.id}
        data-snap={win.snap}
        onPointerDown={onFocus}
        onAnimationEnd={(e) => e.target === e.currentTarget && win.phase && onSettle()}
        className={`win absolute flex flex-col ${docked ? "" : "max-w-[calc(100%-2rem)]"} ${active ? "win-active" : ""} ${win.phase ? `win-${win.phase}` : ""}`}
        style={{ ...place, ...fly, zIndex: z, animationDelay: win.phase === "opening" && win.delay ? `${win.delay}ms` : undefined }}
      >
        <header
          onPointerDown={onDown}
          onPointerMove={onDrag}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={(e) => !(e.target as HTMLElement).closest("button") && onMaximize()}
          title="Drag to a side or the top to dock it"
          className="win-bar flex h-11 shrink-0 cursor-grab touch-none items-center gap-2.5 pr-2 pl-4 select-none active:cursor-grabbing"
        >
          <span className="size-4 shrink-0">{app.glyph}</span>
          <span className="min-w-0 flex-1 truncate text-[0.9rem] font-semibold">{app.title}</span>
          <button onClick={onMinimize} className="win-btn press" aria-label={`Minimize ${app.title}`}>
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
              <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={onMaximize} className="win-btn press" aria-label={`${docked ? "Restore" : "Maximize"} ${app.title}`}>
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              {docked ? (
                <path d="M2.5 4.5h5v5h-5zM4.5 4.5v-2h5v5h-2" strokeLinejoin="round" />
              ) : (
                <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" />
              )}
            </svg>
          </button>
          <button onClick={onClose} className="win-btn win-btn-close press" aria-label={`Close ${app.title}`}>
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
          <div className={docked ? "mx-auto max-w-3xl py-4" : undefined}>
            <app.Content />
          </div>
        </div>
        {/* Edges and corners resize a floating window; the right edge stays thin so it doesn't steal the scrollbar. */}
        {!docked && (
          <>
            {resizeHandle("w", "top-11 bottom-3 left-0 w-1.5 cursor-ew-resize")}
            {resizeHandle("e", "top-11 right-0 bottom-3 w-[3px] cursor-ew-resize")}
            {resizeHandle("s", "right-4 bottom-0 left-4 h-1.5 cursor-ns-resize")}
            {resizeHandle("sw", "bottom-0 left-0 size-4 cursor-nesw-resize")}
            {resizeHandle("se", "right-0 bottom-0 size-4 cursor-nwse-resize")}
          </>
        )}
      </section>
    </>
  );
}

function Taskbar({
  wins,
  topId,
  startOpen,
  setStartOpen,
  onOpen,
  onFocus,
  onMinimize,
  inApp,
  boot,
  menuRoot,
  onSearch,
}: {
  wins: Win[];
  topId?: AppId;
  startOpen: boolean;
  setStartOpen: (v: boolean) => void;
  onOpen: (a: App) => void;
  onFocus: (id: AppId) => void;
  onMinimize: (id: AppId) => void;
  /** A phone has an app open full screen: the taskbar's first button goes back home. */
  inApp: boolean;
  boot: boolean;
  /** The Start menu renders in the desktop root so it keeps the club theme. */
  menuRoot: RefObject<HTMLDivElement | null>;
  onSearch: () => void;
}) {
  return (
    <Menu.Root open={startOpen} onOpenChange={setStartOpen} modal={false}>
      <Menu.Portal container={menuRoot}>
        {/* Sits 1rem above the taskbar, just right of the Start button. */}
        <Menu.Positioner side="top" align="start" sideOffset={rem(1.375)} alignOffset={rem(0.25)} className="z-40">
          <Menu.Popup
            // Short screens: cap to the room Base UI measures and scroll (`!` beats .win overflow: hidden).
            className="win menu-open max-h-(--available-height) w-72 max-w-(--available-width) overflow-y-auto! p-2 outline-none"
            aria-label="Start"
          >
            <Menu.Group>
              <Menu.GroupLabel className="flex items-center gap-3 border-b border-line px-2 pt-1.5 pb-3">
                <ClubLogo className="size-10" />
                <p className="text-sm leading-tight text-dim">
                  {CLUB.name}
                  <br />
                  <span className="font-semibold text-ink">at {CLUB.school}</span>
                </p>
              </Menu.GroupLabel>
              <div className="pt-1.5" />
              {APPS.filter((a) => !a.officer).map((a) => (
                <Menu.Item
                  key={a.id}
                  label={a.label}
                  onClick={() => onOpen(a)}
                  className="press flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-mist data-highlighted:bg-mist"
                >
                  <span className="grid size-8 place-items-center rounded-[8px] bg-[#0b4fa3] p-1.5 text-white">{a.glyph}</span>
                  <span className="font-semibold">{a.label}</span>
                </Menu.Item>
              ))}
              <Menu.LinkItem
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                label="Instagram"
                closeOnClick
                className="press flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 hover:bg-mist data-highlighted:bg-mist"
              >
                <span className="grid size-8 place-items-center rounded-[8px] bg-[linear-gradient(135deg,#d62976,#962fbf_55%,#4f5bd5)] p-1.5 text-white">
                  <InstagramGlyph className="size-full" />
                </span>
                <span className="font-semibold">Instagram</span>
                <span className="ml-auto text-sm text-dim">@{CLUB.instagram}</span>
              </Menu.LinkItem>
            </Menu.Group>
            <Menu.Separator className="mt-2 mb-2 border-t border-line" />
            <Menu.LinkItem
              render={<Link to="/hello-world/host" />}
              closeOnClick
              className="block rounded-[8px] px-2 py-1.5 text-sm text-dim hover:bg-mist data-highlighted:bg-mist"
            >
              Officer sign-in
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      <footer className={`glass taskbar fixed inset-x-0 bottom-0 z-50 flex h-12 items-center gap-1.5 px-2 ${boot ? "boot-taskbar" : ""}`}>
        {inApp && (
          <Link
            to="/"
            className="press flex h-9 items-center gap-1.5 rounded-[8px] pr-3 pl-2 text-sm font-bold hover:bg-white/12 md:hidden"
            aria-label="Back to the home screen"
          >
            <svg viewBox="0 0 12 12" className="size-3.5" aria-hidden>
              <path
                d="M7.5 2.5L4 6l3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Home
          </Link>
        )}
        <Menu.Trigger
          aria-label="Start"
          className={`press flex h-9 items-center gap-2 rounded-[8px] px-2 pr-3 text-sm font-bold hover:bg-white/12 ${startOpen ? "bg-white/15" : ""} ${inApp ? "max-md:hidden" : ""}`}
        >
          <ClubLogo className="size-6" />
          <span className="max-sm:hidden">Programming Club</span>
        </Menu.Trigger>
        <SearchButton onClick={onSearch} />
        <span className="mx-1 h-6 w-px bg-white/15 max-md:hidden" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto max-md:hidden">
          {wins.map((w) => {
            const a = APPS.find((x) => x.id === w.id)!;
            return (
              <button
                key={w.id}
                data-task={w.id}
                // Like a real taskbar: clicking the window that's already in front minimizes it.
                onClick={() => (w.id === topId && !w.min ? onMinimize(w.id) : onFocus(w.id))}
                className={`press task-in relative flex h-9 max-w-48 min-w-0 shrink-0 items-center gap-2 rounded-[8px] px-2.5 text-sm hover:bg-white/10 ${w.id === topId && !w.min ? "bg-white/15 font-semibold" : "text-white/75"}`}
              >
                <span className="size-4 shrink-0">{a.glyph}</span>
                <span className="truncate">{a.title}</span>
                {w.id === topId && !w.min && <span className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-[#7fb0ff]" aria-hidden />}
              </button>
            );
          })}
        </div>
        <NextChip onOpen={onOpen} />
        <Clock />
        <Account />
      </footer>
    </Menu.Root>
  );
}

/** A Floating UI offset in rem, so the menu keeps its place as the root font size scales. */
const rem = (n: number) => () => n * parseFloat(getComputedStyle(document.documentElement).fontSize);

function NextChip({ onOpen }: { onOpen: (a: App) => void }) {
  const plan = useSchedule();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const next = now === null ? null : nextMeeting(plan, now);
  if (!next || now === null) return null;
  return (
    <button
      onClick={() => onOpen(APPS.find((a) => a.id === "meetings")!)}
      className="press ml-auto flex h-9 min-w-0 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold hover:bg-white/10 max-md:flex-1"
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-[#ffb547] opacity-60 motion-reduce:hidden" />
        <span className="relative size-2 rounded-full bg-[#ffb547]" />
      </span>
      <span className="truncate">
        {next.live ? "Meeting happening now" : `Next meeting ${countdown(plan[next.i].start.getTime(), now)}`}
      </span>
    </button>
  );
}

/** Signed in: the officer's photo, with a menu that links to the host console. Signed out: a sign-in button. */
function Account() {
  return (
    <span className="flex h-9 shrink-0 items-center rounded-[8px] px-1.5 hover:bg-white/10">
      <Show when="signed-in">
        {/* Holds the avatar's place while Clerk's scripts load, so the taskbar doesn't jump. */}
        <UserButton fallback={<span className="block size-7 rounded-full bg-white/20" />}>
          <UserButton.MenuItems>
            <UserButton.Link label="Host console" labelIcon={<ClubLogo className="size-4" />} href="/hello-world/host" />
          </UserButton.MenuItems>
        </UserButton>
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            className="press grid size-8 place-items-center rounded-full text-white/85 hover:text-white"
            aria-label="Officer sign-in"
            title="Officer sign-in"
          >
            <svg viewBox="0 0 20 20" className="size-6" aria-hidden>
              <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="8" r="3" fill="currentColor" />
              <path d="M4.5 15.5c1.2-2.2 3.2-3.3 5.5-3.3s4.3 1.1 5.5 3.3" fill="currentColor" />
            </svg>
          </button>
        </SignInButton>
      </Show>
    </span>
  );
}

function Clock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: CLUB.timeZone }));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return <span className="w-[4.5rem] shrink-0 pr-1 text-right text-sm text-white/85 tabular-nums max-sm:hidden">{t}</span>;
}

/** Phones: a home screen of apps; with an app open, it fills the screen. */
type BootIn = (i: number) => { className: string; style?: CSSProperties };

function Phone({ routeApp, onOpen, bootIn }: { routeApp: App | null; onOpen: (a: App) => void; bootIn: BootIn }) {
  const iconApps = useIconApps();
  if (routeApp)
    return (
      <div key={routeApp.id} className="phone-in absolute inset-0 bottom-12 z-30 flex flex-col bg-paper md:hidden">
        <header className="win-bar flex h-12 shrink-0 items-center justify-center gap-2 bg-white px-4 text-ink shadow-[inset_0_2px_0_#1f63d6]">
          <span className="size-4 shrink-0">{routeApp.glyph}</span>
          <span className="truncate font-semibold">{routeApp.title}</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <routeApp.Content />
        </div>
      </div>
    );
  return (
    <div className="absolute inset-0 bottom-12 overflow-y-auto px-6 pt-8 pb-6 md:hidden">
      <div {...bootIn(0)}>
        <ClubLogo className="size-12" />
      </div>
      <div {...bootIn(1)}>
        <p className="mt-4 text-2xl leading-tight font-extrabold tracking-[-0.02em] text-white">{CLUB.name}</p>
        <p className="text-white/65">at {CLUB.school}</p>
      </div>
      <a
        style={bootIn(2).style}
        href="/site"
        onClick={(e) => {
          e.preventDefault();
          onOpen(APPS.find((a) => a.id === "site")!);
        }}
        className={`mt-3 inline-block text-xs text-white/60 underline decoration-white/30 underline-offset-2 ${bootIn(2).className}`}
      >
        Not an official Henry Ford College site
      </a>
      <div className="mt-10 grid grid-cols-3 gap-x-3 gap-y-7">
        {iconApps.map((a, i) => (
          <button
            key={a.id}
            onClick={() => onOpen(a)}
            style={bootIn(3 + i).style}
            className={`press flex flex-col items-center gap-2 text-center ${bootIn(3 + i).className}`}
          >
            <Icon app={a} size="lg" />
            <span className="text-[0.8rem] leading-tight font-semibold text-white">{a.label}</span>
          </button>
        ))}
      </div>
      <div {...bootIn(3 + iconApps.length)}>
        <InstagramLink className="mt-10 rounded-full bg-white/12 px-4 py-2.5 text-sm text-white hover:bg-white/20" />
      </div>
    </div>
  );
}

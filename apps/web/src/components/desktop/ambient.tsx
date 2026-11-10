// The desktop answers the pointer. Holiday bulbs brighten as it nears and swing when it brushes past, the painted wallpaper
// shifts with it for depth (each layer by its --depth, the falling snow most of all), and a soft light sits on the wallpaper
// behind the window in front, following it around.
// One animation frame does it all, and only while something is still settling; a still pointer costs nothing.
// Mouse and pen only. Reduced motion keeps the brightening and the light but drops the swinging and the parallax.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** How far a bulb feels the pointer, in pixels. */
const REACH = 170;
/** How close the pointer has to pass to set a bulb swinging. */
const BRUSH = 90;
/** How far a depth-1 layer (the shore) moves when the pointer is at the screen's edge. */
const SHIFT = { x: 9, y: 4 };
/** How far the light reaches past the window's edges. */
const SPILL = 140;

type Bulb = { el: HTMLElement; x: number; y: number; near: number; angle: number; spin: number };

export function Ambient({ root, parallax }: { root: RefObject<HTMLDivElement | null>; parallax: boolean }) {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desk = root.current;
    const light = glow.current;
    if (!desk || !light) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const roomy = matchMedia("(pointer: fine) and (min-width: 48rem)");

    let bulbs: Bulb[] = [];
    let measured = false;
    const measure = () => {
      measured = true;
      bulbs = [...desk.querySelectorAll<HTMLElement>(".lights-bulb")]
        .filter((el) => el.offsetParent)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { el, x: r.left + r.width / 2, y: r.top + r.height, near: 0, angle: 0, spin: 0 };
        });
    };

    // Pointer, in viewport pixels (far away when it's off the page), and how fast it moved across since the last frame.
    let x = -1e5;
    let y = -1e5;
    let push = 0;
    let at = 0;
    // The wallpaper's eased offset, -1 to 1 on each axis.
    let sx = 0;
    let sy = 0;
    let placed = "";
    let raf = 0;
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const frame = () => {
      raf = 0;
      let busy = false;
      const calm = still.matches;
      // The lights mount after the desktop does, so an empty list is measured again.
      if (!measured || !bulbs.length || bulbs.some((b) => !b.el.isConnected)) measure();

      for (const b of bulbs) {
        const d = Math.hypot(x - b.x, y - b.y);
        const t = Math.max(0, 1 - d / REACH);
        const target = t * t * (3 - 2 * t);
        b.near += (target - b.near) * 0.22;
        if (Math.abs(target - b.near) > 0.004) busy = true;
        else b.near = target;
        if (!calm) {
          // Brushing a bulb rightward swings its glass right, which is a counterclockwise turn about the socket.
          if (push && d < BRUSH) b.spin -= push * 0.28 * (1 - d / BRUSH);
          b.spin = (b.spin - b.angle * 0.05) * 0.92;
          b.angle = Math.max(-24, Math.min(24, b.angle + b.spin));
          if (Math.abs(b.angle) > 0.05 || Math.abs(b.spin) > 0.05) busy = true;
          else b.angle = b.spin = 0;
        }
        b.el.style.setProperty("--near", b.near.toFixed(3));
        b.el.style.setProperty("--swing", `${b.angle.toFixed(2)}deg`);
      }
      push = 0;

      if (parallax && !calm && roomy.matches) {
        const off = x < -1e4;
        const tx = off ? 0 : (x / innerWidth) * 2 - 1;
        const ty = off ? 0 : (y / innerHeight) * 2 - 1;
        sx += (tx - sx) * 0.035;
        sy += (ty - sy) * 0.035;
        if (Math.abs(tx - sx) > 0.001 || Math.abs(ty - sy) > 0.001) busy = true;
        desk.style.setProperty("--px", `${(-sx * SHIFT.x).toFixed(2)}px`);
        desk.style.setProperty("--py", `${(-sy * SHIFT.y).toFixed(2)}px`);
      }

      // The light behind the front window. Its CSS transition does the gliding, so this only places it.
      const front = desk.querySelector<HTMLElement>(".win-active:not(.win-closing):not(.win-minimizing)");
      const r = front?.getBoundingClientRect();
      const next = r
        ? `${Math.round(r.left - SPILL)},${Math.round(r.top - SPILL / 2)},${Math.round(r.width + SPILL * 2)},${Math.round(r.height + SPILL * 1.5)}`
        : "";
      if (next !== placed) {
        placed = next;
        if (r) {
          const [l, t, w, h] = next.split(",");
          light.style.translate = `${l}px ${t}px`;
          light.style.width = `${w}px`;
          light.style.height = `${h}px`;
        }
        light.style.opacity = r ? "" : "0";
      }

      if (busy) kick();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const dt = Math.max(8, e.timeStamp - at);
      if (x > -1e4) push += ((e.clientX - x) / dt) * 16;
      x = e.clientX;
      y = e.clientY;
      at = e.timeStamp;
      kick();
    };
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      x = y = -1e5;
      kick();
    };
    // Bulbs sit still, so they're measured once, then again after a resize or the startup zoom.
    const onResize = () => {
      measured = false;
      kick();
    };
    const onSettled = (e: AnimationEvent) => {
      if ((e.target as HTMLElement).classList.contains("boot-wallpaper")) onResize();
    };
    // Windows open, close, move, and finish animating without the pointer moving (Escape, the taskbar, a link).
    const windows = desk.querySelector("[data-windows]");
    const watch = new MutationObserver(kick);
    if (windows) watch.observe(windows, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });

    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerout", onOut);
    addEventListener("resize", onResize);
    windows?.addEventListener("animationend", kick);
    desk.addEventListener("animationend", onSettled);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onOut);
      removeEventListener("resize", onResize);
      windows?.removeEventListener("animationend", kick);
      desk.removeEventListener("animationend", onSettled);
    };
  }, [root, parallax]);

  return <div ref={glow} aria-hidden className="desk-glow max-md:hidden" style={{ opacity: 0 }} />;
}

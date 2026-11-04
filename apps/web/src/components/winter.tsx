// Winter on the club desktop, the TV, and the join page (November through February: isWinter in lib/season.ts). Snow
// falling, a string of holiday lights in the club's colors, and on the TV a row of snowy pines. All CSS and SVG, so
// there's nothing to load. Each piece is decoration only: aria-hidden, no pointer events, and laid out by its parent.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import "./winter.css";

/** Browser-only, like the wallpaper scenes: the positions come from Math.sin, which needn't match the server's to the
 *  last digit, so rendering on the server could mismatch on hydration. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** A fixed sequence in [0, 1), so the snow and the lights are the same on every visit (and on the server). */
const rand = (i: number, k: number) => (((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;

// Flakes, near ones bigger, brighter, and quicker than far ones. Sizes and sway are in --snow-unit (see winter.css).
const FLAKES = Array.from({ length: 120 }, (_, i) => {
  const near = rand(i, 3) ** 1.6;
  const fall = 17 - near * 9 + rand(i, 4) * 4;
  return {
    x: rand(i, 1) * 100,
    size: 0.4 + near * 0.9,
    opacity: 0.4 + near * 0.55,
    fall,
    delay: -rand(i, 5) * fall,
    sway: 1.5 + rand(i, 6) * 3,
    swayTime: 2.5 + rand(i, 7) * 3,
    swayDelay: -rand(i, 8) * 5,
  };
});

/** Snow falling across the parent (which needs a position). `always` keeps it falling with reduced motion, for the TV;
 *  otherwise reduced motion stills every flake partway down. */
export function Snow({ count = 60, always = false, className = "" }: { count?: number; always?: boolean; className?: string }) {
  if (!useMounted()) return null;
  return (
    <div aria-hidden className={`snow ${className}`} data-always={always || undefined}>
      {FLAKES.slice(0, count).map((f, i) => (
        <span key={i} className="snow-fall" style={{ left: `${f.x}%`, "--t": `${f.fall}s`, "--d": `${f.delay}s` } as CSSProperties}>
          <span
            style={
              { "--s": f.size, "--o": f.opacity, "--sway": f.sway, "--st": `${f.swayTime}s`, "--sd": `${f.swayDelay}s` } as CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}

// The club's tile colors, in the order the bulbs take them.
const BULBS = ["var(--color-signal)", "var(--color-gold)", "var(--color-meadow)", "var(--color-sky)", "var(--color-sun)"];
// The wire, in a box 100 units tall per swag: it's tied up at TOP and droops SAG at the middle of each swag.
const TOP = 4;
const SAG = 52;

/** A string of holiday lights draped along the top of the parent, in `swags` loops of `per` bulbs. Sizes come from
 *  --lights-h, --bulb, and --wire (see winter.css). `always` keeps it twinkling with reduced motion, for the TV. */
export function Lights({
  swags,
  per = 4,
  always = false,
  className = "",
}: {
  swags: number;
  per?: number;
  always?: boolean;
  className?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  // Each swag is one quadratic curve: a control point 2 × SAG down puts the curve's lowest point SAG down.
  const wire = `M 0 ${TOP} ${Array.from({ length: swags }, (_, i) => `Q ${i * 100 + 50} ${TOP + 2 * SAG} ${(i + 1) * 100} ${TOP}`).join(" ")}`;
  const bulbs = Array.from({ length: swags * per }, (_, n) => {
    const u = ((n % per) + 0.5) / per;
    // A bulb hangs from the wire, tipped a little the way the wire slopes there.
    return {
      left: ((Math.floor(n / per) + u) / swags) * 100,
      top: TOP + 4 * SAG * u * (1 - u),
      tilt: (u - 0.5) * -34 + (rand(n, 1) - 0.5) * 10,
      color: BULBS[n % BULBS.length],
      // Most glow softly; every so often one blinks.
      time: n % 7 === 3 ? 0.9 : 1.8 + rand(n, 2) * 2.4,
      delay: -rand(n, 3) * 4,
    };
  });
  return (
    <div aria-hidden className={`lights ${className}`} data-always={always || undefined}>
      <svg viewBox={`0 0 ${swags * 100} 100`} preserveAspectRatio="none">
        <path d={wire} />
      </svg>
      {bulbs.map((b, i) => (
        <span
          key={i}
          className="lights-bulb"
          style={
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              "--tilt": `${b.tilt}deg`,
              "--c": b.color,
              "--tw": `${b.time}s`,
              "--td": `${b.delay}s`,
            } as CSSProperties
          }
        >
          <i />
        </span>
      ))}
    </div>
  );
}

// The TV's treeline, in a 1600 × 240 box: a far row and a near row of pines, tallest out at the edges so the middle,
// where the words are, stays low. Each pine is three tiers with snow on top of each.
const W = 1600;
const H = 240;
function pine(cx: number, h: number, base: number) {
  const tiers = [
    [1, 0.56, 0.16],
    [0.8, 0.32, 0.23],
    [0.58, 0.1, 0.3],
  ].map(([top, bottom, half]) => [base - h * top, base - h * bottom, h * half]);
  const tree =
    tiers.map(([a, b, w]) => `M${cx} ${a}L${cx + w} ${b}Q${cx} ${b - h * 0.06} ${cx - w} ${b}Z`).join("") +
    `M${cx - h * 0.035} ${base - h * 0.12}h${h * 0.07}V${base}h${-h * 0.07}Z`;
  const snow = tiers
    .map(([a, b, w]) => {
      const at = (x: number, down: number) => `${cx + w * x} ${a + (b - a) * down}`;
      return `M${cx} ${a}L${at(0.5, 0.5)}Q${at(0.32, 0.36)} ${at(0.12, 0.5)}Q${at(-0.08, 0.34)} ${at(-0.26, 0.47)}Q${at(-0.4, 0.38)} ${at(-0.5, 0.5)}Z`;
    })
    .join("");
  return { tree, snow };
}
function treeline(step: number, low: number, high: number, k: number) {
  const trees = [];
  for (let i = 0, x = -30; x < W + 30; i++, x += step * (0.75 + rand(i, k) * 0.5)) {
    const edge = Math.abs(x - W / 2) / (W / 2);
    trees.push(pine(x, low + (high - low) * edge ** 2.4 + rand(i, k + 1) * 26, H - 8 - rand(i, k + 2) * 10));
  }
  return { tree: trees.map((t) => t.tree).join(""), snow: trees.map((t) => t.snow).join("") };
}
const FAR = treeline(34, 40, 105, 10);
const NEAR = treeline(64, 26, 140, 20);
// Snow on the ground: a soft drift across the bottom.
const DRIFT = `M0 ${H - 18}${Array.from({ length: 8 }, (_, i) => {
  const x = (i + 1) * (W / 8);
  return `Q${x - W / 16} ${H - 30 - rand(i, 30) * 16} ${x} ${H - 16 - rand(i, 31) * 8}`;
}).join("")}V${H}H0Z`;

/** Snowy pines along the bottom of the parent, its full width. */
export function Pines({ className = "" }: { className?: string }) {
  if (!useMounted()) return null;
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className={`pines ${className}`}>
      <path d={FAR.tree} className="pines-far" />
      <path d={FAR.snow} className="pines-far-snow" />
      <path d={NEAR.tree} className="pines-near" />
      <path d={NEAR.snow} className="pines-snow" />
      <path d={DRIFT} className="pines-drift" />
    </svg>
  );
}

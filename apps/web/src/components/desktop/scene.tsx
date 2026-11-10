// The wallpaper as painted layers (public/wallpaper/layers), each moving on its own: the camera sways so the
// snowy shore slides past faster than the sea and cliffs, the clouds drift across, and the moonlight shimmers.
// Layers sit on a 16:9 stage (or a portrait stage on phones) that covers the screen, so nothing stretches.
// Positions are percentages of the stage: [left, top, width, height] on desktop, then on phones.
// When the screen is shorter than the stage, the moon and clouds stay pinned to the top and the rest ("low")
// to the bottom, so the horizon rises a little instead of the moon or the shore getting cropped.
// Some layers are drawn in code instead of painted (stars, mist, the far town's lights): they move with the painted
// layer at the same depth, and their own motion stops with reduced motion (see the end of styles.css).
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { rand } from "#/components/winter";

type Box = [number, number, number, number];
type Layer = {
  id: string;
  depth: number;
  desk: Box;
  phone: Box;
  low?: boolean;
  kind?: "clouds" | "moon" | "shimmer" | "floes" | "drift" | "haze" | "flip";
  /** Drawn in code rather than loaded from /wallpaper/layers. */
  draw?: () => ReactNode;
};

const CLOUDS: Box = [-5.02, 5.84, 110.05, 48.14];
const CLOUDS_PHONE: Box = [-65, 5.5, 180, 46];
const MOON: Box = [67.88, 8.5, 13.46, 23.91];
// On phones the moon sits top-right, clear of the club name, with its reflection below it.
const MOON_PHONE: Box = [76, 11, 20, 9.24];
const PATH: Box = [64.59, 53.13, 20.93, 44.63];
const PATH_PHONE: Box = [53.5, 55.4, 65, 30];
const CLIFFS: Box = [-5.02, 26.57, 110.05, 28.06];
const CLIFFS_PHONE: Box = [-80, 41.45, 200, 15];
// The lighthouse stands on the far headland's tip; the cabin and its pines on the snowy spit behind the shore.
const LIGHTHOUSE: Box = [50.5, 47.2, 3.2, 6.5];
const LIGHTHOUSE_PHONE: Box = [20, 51.9, 7, 3.7];
const CABIN: Box = [89.6, 53.9, 4.4, 5.4];
const CABIN_PHONE: Box = [88, 61.2, 10, 3.2];

/* ---------- drawn layers ---------- */

/** A sky of stars, thinning and dimming toward the horizon; one in five twinkles. */
function Stars() {
  return (
    <div className="scene-stars">
      {Array.from({ length: 150 }, (_, i) => {
        const y = rand(i, 4) ** 1.6 * 100;
        return (
          <span
            key={i}
            style={
              {
                left: `${rand(i, 5) * 100}%`,
                top: `${y}%`,
                "--s": `${0.08 + rand(i, 6) ** 3 * 0.16}rem`,
                "--o": (1 - y / 120) * (0.35 + rand(i, 7) * 0.65),
                "--tw": i % 5 === 0 ? `${2.5 + rand(i, 8) * 4}s` : "0s",
                "--td": `${-rand(i, 9) * 6}s`,
              } as CSSProperties
            }
          />
        );
      })}
      {/* Now and then, one falls. */}
      <i className="scene-meteor" />
      <i className="scene-meteor scene-meteor-late" />
    </div>
  );
}

/** Lamplit windows of a town along the foot of the far cliffs, at percentages of the cliffs painting. */
function Town() {
  return (
    <div className="scene-town">
      {Array.from({ length: 34 }, (_, i) => {
        const x = 66 + rand(i, 11) * 31;
        // Most sit along the waterline; a few climb the slope behind it.
        const y = 94.5 - (i % 4 === 0 ? rand(i, 12) * 14 : rand(i, 13) * 2.5);
        return (
          <span
            key={i}
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                "--o": 0.55 + rand(i, 14) * 0.45,
                "--tw": `${3 + rand(i, 15) * 5}s`,
                "--td": `${-rand(i, 16) * 8}s`,
                "--c": i % 6 === 0 ? "#fff3d6" : "#ffc773",
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** The lighthouse's beam, from the lantern (at 52.5%, 10% of the painting): a lamp turning, seen side-on, so the beam
 *  sweeps out one way, shrinks to a flash as it faces us, and sweeps out the other way. */
const Beam = () => (
  <div className="scene-beam" style={{ left: "52.5%", top: "10%" }}>
    <i />
    <b />
  </div>
);

/** Woodsmoke from the cabin's chimney (36%, 2% of the painting), and its windows flickering with firelight. */
const Hearth = () => (
  <div className="absolute inset-0">
    <div className="scene-smoke" style={{ left: "36%", top: "2%" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
    {[
      [26, 60],
      [52, 57.5],
      [77, 59],
    ].map(([x, y], i) => (
      <i key={i} className="scene-fire" style={{ left: `${x}%`, top: `${y}%`, "--i": i } as CSSProperties} />
    ))}
  </div>
);

/** Low mist lying on the water at the horizon, drifting slowly. */
const Mist = () => (
  <div className="scene-mist">
    <i />
    <i />
  </div>
);

// Back to front. Depth is how far a layer travels with the camera's sway and the pointer: things standing on the shore
// share its depth, so they never slide over the ground under them.
const LAYERS: Layer[] = [
  { id: "sky", low: true, depth: 0, desk: [-5.02, 0, 110.05, 106.27], phone: [-100, 0, 210, 108] },
  { id: "stars", depth: 0.01, desk: [-5, 0, 110, 52], phone: [-100, 0, 210, 44], draw: Stars },
  { id: "clouds-far", depth: 0.08, desk: CLOUDS, phone: CLOUDS_PHONE, kind: "clouds" },
  { id: "clouds-near", depth: 0.16, desk: CLOUDS, phone: CLOUDS_PHONE, kind: "clouds" },
  { id: "moon", depth: 0.025, desk: MOON, phone: MOON_PHONE, kind: "moon" },
  { id: "ridge-far", low: true, depth: 0.06, desk: [-5, 50.5, 67, 2.84], phone: [-60, 54.3, 100, 1.1], kind: "haze" },
  { id: "cliffs", low: true, depth: 0.12, desk: CLIFFS, phone: CLIFFS_PHONE },
  { id: "town", low: true, depth: 0.12, desk: CLIFFS, phone: CLIFFS_PHONE, draw: Town },
  { id: "lighthouse", low: true, depth: 0.12, desk: LIGHTHOUSE, phone: LIGHTHOUSE_PHONE },
  { id: "beam", low: true, depth: 0.12, desk: LIGHTHOUSE, phone: LIGHTHOUSE_PHONE, draw: Beam },
  { id: "sea", low: true, depth: 0.25, desk: [-5.02, 53.13, 110.05, 53.13], phone: [-90, 55.4, 200, 50] },
  { id: "mist", low: true, depth: 0.18, desk: [-5, 49.5, 110, 9], phone: [-90, 52, 200, 7], draw: Mist },
  { id: "ice-floes", low: true, depth: 0.32, desk: [-5, 54.6, 60, 8.5], phone: [-90, 56.4, 200, 7], kind: "floes" },
  { id: "moonpath", low: true, depth: 0.25, desk: PATH, phone: PATH_PHONE, kind: "shimmer" },
  // Flipped, so the tallest trees stand behind the cabin and the line thins out past the screen's edge.
  { id: "pines", low: true, depth: 1, desk: [86, 46.6, 30, 14], phone: [82, 58.6, 50, 6.1], kind: "flip" },
  { id: "cabin", low: true, depth: 1, desk: CABIN, phone: CABIN_PHONE },
  { id: "hearth", low: true, depth: 1, desk: CABIN, phone: CABIN_PHONE, draw: Hearth },
  { id: "shore", low: true, depth: 1, desk: [38.88, 54.2, 66.99, 53.13], phone: [-37, 62.07, 155, 44] },
  { id: "drift", low: true, depth: 1.6, desk: [-12, 75.4, 56, 27.6], phone: [-30, 88.9, 110, 14.1], kind: "drift" },
];

/** How many layers have a painting to wait for. */
const PAINTED = LAYERS.filter((l) => !l.draw).length;

const vars = ([l, t, w, h]: Box, p: string) => ({ [`--${p}l`]: `${l}%`, [`--${p}t`]: `${t}%`, [`--${p}w`]: `${w}%`, [`--${p}h`]: `${h}%` });

export function Scene() {
  const [loaded, setLoaded] = useState(0);
  // Browser-only, so every image's load event is caught (server-rendered images can finish before hydration).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const onLoad = () => setLoaded((n) => n + 1);
  if (!mounted) return null;
  return (
    // The flat painting underneath stays until every layer has loaded, then the scene fades in over it.
    <div aria-hidden className={`scene ${loaded >= PAINTED ? "scene-ready" : ""}`}>
      {LAYERS.map((l) => {
        const src = `/wallpaper/layers/${l.id}.webp`;
        const style = { ...vars(l.desk, ""), ...vars(l.phone, "p"), "--depth": l.depth } as CSSProperties;
        return (
          <div key={l.id} className={`scene-layer ${l.low ? "scene-low" : ""}`} style={style}>
            {l.draw ? (
              <l.draw />
            ) : l.kind === "clouds" ? (
              // Two copies of a seamless strip, scrolled by one strip's width, loop without a seam.
              <div className={`scene-clouds scene-${l.id}`} style={{ backgroundImage: `url(${src})` }}>
                <img src={src} alt="" className="hidden" onLoad={onLoad} />
              </div>
            ) : (
              <img src={src} alt="" decoding="async" onLoad={onLoad} className={`size-full ${l.kind ? `scene-${l.kind}` : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

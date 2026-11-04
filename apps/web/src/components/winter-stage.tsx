// Winter nights on the TV, as the spooky night dressed its own (spooky-stage.tsx, graveyard.tsx), in cut paper: a
// winter night of torn-paper hills and snowy pines under the club's lights. The lobby is a big lit pine where each
// player who joins gets a present with their name on it; a round's title goes up on a snowy signboard; the standings
// sit over the night; and screens change behind snowy stage flats with a burst of snowflakes. All SVG and CSS, drawn
// from a fixed sequence, so there's nothing to load and it's the same on every visit. Like the spooky night it moves
// even with reduced motion on: it's a shared display.
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useFitName, useFlip } from "./graveyard";
import { InstagramGlyph } from "./instagram";
import { useShift } from "./spooky-stage";
import { Lights, Snow, pine, rand, useMounted } from "./winter";
import { CLUB } from "#/lib/season";
import { tieredRows } from "#/lib/spooky";
import "./winter-stage.css";

type Pt = [number, number];

/** The line through `pts`, torn: a point every `step` along each stretch, nudged up to `amp` either side of it. */
function tear(pts: Pt[], step: number, amp: number, k: number): Pt[] {
  const out: Pt[] = [];
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const m = Math.max(1, Math.round(len / step));
    for (let j = 0; j < m; j++) {
      const t = j / m;
      const d = (rand(n++, k) - 0.5) * 2 * amp;
      out.push([x0 + (x1 - x0) * t - ((y1 - y0) / len) * d, y0 + (y1 - y0) * t + ((x1 - x0) / len) * d]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const shape = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;

// Strips are drawn 1600 wide, as tall as they need, and laid along the bottom of the scene at its full width.
const W = 1600;

/** A torn-paper hill across a strip `h` tall: its top at `top(x)`, solid to the bottom. */
function hill(h: number, top: (x: number) => number, k: number) {
  const line: Pt[] = Array.from({ length: 41 }, (_, i) => [i * 40 - 20, top(i * 40 - 20)]);
  return shape([...tear(line, 7, 1.6, k), [W + 20, h + 2], [-20, h + 2]]);
}
const wave = (x: number, f: number, p: number) => Math.sin((x / W) * Math.PI * 2 * f + p);

/** Pines along a strip: every `step` or so, standing on `foot(x)`, `low` to `low + jitter` tall, and up to `corner`
 *  taller toward the sides (past `from` of the way out from the middle). */
function forest(foot: (x: number) => number, step: number, low: number, jitter: number, corner: number, from: number, k: number) {
  const tree: string[] = [];
  const snow: string[] = [];
  for (let i = 0, x = -30; x < W + 30; i++, x += step * (0.7 + rand(i, k) * 0.6)) {
    const out = Math.min(1, Math.max(0, (Math.abs(x - W / 2) / (W / 2) - from) / (1 - from)));
    const p = pine(x, low + rand(i, k + 1) * jitter + corner * out ** 1.3, foot(x) + 4 + rand(i, k + 2) * 6);
    tree.push(p.tree);
    snow.push(p.snow);
  }
  return { tree: tree.join(""), snow: snow.join("") };
}

// The night's hills, back to front. Far: a long snowy rise with a far row of pines, 1600 × 300.
const FAR_TOP = (x: number) => 168 + 34 * wave(x, 1.2, 0.6) + 18 * wave(x, 3.1, 2);
const FAR = { hill: hill(300, FAR_TOP, 40), ...forest(FAR_TOP, 22, 26, 26, 30, 0.6, 41) };
// The row of pines the signboard comes up out of, 1600 × 240.
const ROW = forest(() => 226, 46, 70, 46, 120, 0.55, 50);
// The snow along the front, 1600 × 120: the lobby's ground, and the foot of everything else.
const NEAR_TOP = (x: number) => 52 + 10 * wave(x, 1.6, 1.2) + 6 * wave(x, 4.3, 0.2);
const NEAR = hill(120, NEAR_TOP, 60);
// The standings' low ground, 1600 × 90: a drift, with a few pines only out in the corners.
const LOW_TOP = (x: number) => 58 + 6 * wave(x, 2.2, 0.4);
const LOW = { hill: hill(90, LOW_TOP, 70), ...forest(() => 66, 34, 0, 0, 74, 0.8, 71) };

const Strip = ({ h, className, children }: { h: number; className: string; children: ReactNode }) => (
  <svg aria-hidden viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="xMidYMax slice" className={`wn-strip ${className}`}>
    {children}
  </svg>
);
/** A torn hill: the paper's white core along the tear, under its colored face. */
const Torn = ({ d, className }: { d: string; className: string }) => (
  <>
    <path d={d} className="wn-fiber" transform="translate(0 -2.2)" />
    <path d={d} className={className} />
  </>
);

// Stars: across (%), down (%), size (cqw), twinkle seconds and start.
const STARS = Array.from({ length: 46 }, (_, i) => [
  rand(i, 80) * 100,
  rand(i, 81) ** 1.5 * 62,
  0.14 + rand(i, 82) * 0.22,
  2.5 + rand(i, 83) * 4,
  -rand(i, 84) * 6,
]);

/** The winter night behind a screen: the sky with its stars, northern lights and moon, the far hills and their pines,
 *  snow falling, and the club's lights across the top. `ground` picks what's along the bottom: the pines a sign comes up
 *  out of ("row"), the lobby's snowy ground ("ground"), or a low drift that leaves the standings the room ("low"). */
function WinterNight({ ground, children }: { ground: "row" | "ground" | "low"; children?: ReactNode }) {
  const mounted = useMounted();
  return (
    <div className={`wn wn-is-${ground} absolute inset-0`}>
      <div className="wn-aurora" aria-hidden>
        <i />
        <i />
      </div>
      {mounted &&
        STARS.map(([x, y, s, t, d], i) => (
          <span
            key={i}
            aria-hidden
            className="wn-star"
            style={{ left: `${x}%`, top: `${y}%`, "--s": `${s}cqw`, "--t": `${t}s`, "--d": `${d}s` } as CSSProperties}
          />
        ))}
      <Moon />
      {mounted && (
        <>
          {ground === "low" ? (
            <Strip h={90} className="wn-low">
              <Torn d={LOW.hill} className="wn-snowfield" />
              <path d={LOW.tree} className="wn-pine" />
              <path d={LOW.snow} className="wn-pine-snow" />
            </Strip>
          ) : (
            <Strip h={300} className="wn-back">
              <path d={FAR.tree} className="wn-far-pine" />
              <path d={FAR.snow} className="wn-far-pine-snow" />
              <Torn d={FAR.hill} className="wn-far" />
            </Strip>
          )}
          <div className="wn-snow">
            <Snow count={ground === "low" ? 60 : 90} always />
          </div>
          {ground === "row" && (
            <Strip h={240} className="wn-row">
              <path d={ROW.tree} className="wn-pine" />
              <path d={ROW.snow} className="wn-pine-snow" />
            </Strip>
          )}
        </>
      )}
      {children}
      {mounted && ground !== "low" && (
        <Strip h={120} className="wn-near">
          <Torn d={NEAR} className="wn-snowfield" />
        </Strip>
      )}
      <div className="wn-lights" aria-hidden>
        <Lights swags={7} per={5} always />
      </div>
      <div className="wn-grain" aria-hidden />
    </div>
  );
}

const MOON = shape(
  tear(
    Array.from({ length: 37 }, (_, i): Pt => [50 + 46 * Math.cos(i / 5.73), 50 + 46 * Math.sin(i / 5.73)]),
    3,
    0.9,
    90,
  ),
);
const Moon = () => (
  <div className="wn-moon" aria-hidden>
    <svg viewBox="0 0 100 100">
      <path d={MOON} className="wn-fiber" />
      <path d={MOON} transform="translate(50 50) scale(0.96) translate(-50 -50)" fill="#f2ecd6" />
      <circle cx="36" cy="40" r="9" fill="#e2dbc0" />
      <circle cx="62" cy="58" r="12" fill="#e5dec4" />
      <circle cx="58" cy="30" r="5" fill="#e2dbc0" />
    </svg>
  </div>
);

/** A round's number above the sign, its game on it, and anything else as it is: "Round 2, double points: Wiki Race". */
function parse(message: string) {
  const round = message.match(/^Round (\d+)(, double points)?: (.+)$/);
  return round ? { round: round[1], double: !!round[2], text: round[3] } : { round: null, double: false, text: message };
}

// The signboard, 1000 × 600: two posts, a board of two torn layers, snow along its top, and icicles under it.
const BOARD = shape(
  tear(
    [
      [40, 118],
      [962, 96],
      [976, 408],
      [28, 424],
      [40, 118],
    ],
    9,
    2.6,
    100,
  ),
);
const FACE = shape(
  tear(
    [
      [70, 140],
      [934, 122],
      [944, 386],
      [60, 398],
      [70, 140],
    ],
    9,
    2.2,
    101,
  ),
);
const POSTS = [230, 770].map((x, i) =>
  shape(
    tear(
      [
        [x - 26, 60],
        [x + 26, 56],
        [x + 30, 620],
        [x - 30, 620],
        [x - 26, 60],
      ],
      10,
      2,
      102 + i,
    ),
  ),
);
const CAP = shape(
  tear(
    [
      [26, 124],
      ...Array.from({ length: 21 }, (_, i): Pt => [30 + i * 47, 98 - 20 * (i % 2 ? 0.6 : 1) * (0.7 + rand(i, 104) * 0.6) - (i * 22) / 20]),
      [976, 102],
      // Along the face's top edge, with a drip every third.
      ...Array.from({ length: 21 }, (_, i): Pt => [
        976 - i * 47,
        146 - ((976 - i * 47) / 1000) * 20 + (i % 3 === 1 ? 12 + rand(i, 105) * 16 : 0),
      ]),
    ],
    8,
    1.4,
    106,
  ),
);
const ICICLES = Array.from({ length: 13 }, (_, i) => {
  const x = 90 + i * 66 + rand(i, 107) * 20;
  const y = 422 - (x / 1000) * 14;
  const l = 18 + rand(i, 108) * 36;
  return `M${x - 7} ${y}L${x + 7} ${y}L${x + 1} ${y + l}Z`;
}).join("");

/**
 * A message on the TV, on a snowy signboard that rises out of the pines. A round's title ("Round 2, double points: Wiki
 * Race") puts its number above the sign and its game on it.
 */
export function WinterMessage({ message }: { message: string }) {
  const { round, double, text } = parse(message);
  // As big as fits on the board's face, about 50 × 16cqw, however long it is.
  const size = Math.min(5.4, Math.sqrt((50 * 16) / (Math.max(1, text.length) * 0.6 * 1.6)));
  const cut = text.lastIndexOf(" ");
  return (
    <WinterNight ground="row">
      {round && (
        <p className="wn-kicker absolute inset-x-0 top-[6.5cqw] z-[6] text-center text-[3cqw] font-bold">
          round {round}
          {double && <span className="text-sun"> · double points</span>}
        </p>
      )}
      <div className="wn-sign">
        <svg viewBox="0 0 1000 600" aria-hidden>
          {POSTS.map((d, i) => (
            <path key={i} d={d} fill="#6b4529" />
          ))}
          <path d={BOARD} fill="#7c5232" />
          <path d={FACE} className="wn-fiber" transform="translate(0 -2)" />
          <path d={FACE} fill="#e3c99a" />
          <path d={ICICLES} fill="#dcebee" />
          <path d={CAP} className="wn-fiber" transform="translate(0 -2)" />
          <path d={CAP} fill="#f3f8f6" />
        </svg>
        <div className="wn-face">
          <h2 className="leading-[1.05] tracking-[-0.035em] text-balance lowercase" style={{ fontSize: `${size.toFixed(2)}cqw` }}>
            {text.slice(0, cut + 1)}
            <span className="text-[#b83a24]">{text.slice(cut + 1)}</span>
          </h2>
        </div>
      </div>
    </WinterNight>
  );
}

/** The standings (or anything else that fills the screen) over the winter night, with a low drift along the bottom. */
export function WinterBoard({ children }: { children: ReactNode }) {
  return (
    <WinterNight ground="low">
      <div className="absolute inset-0 z-[6] p-[3.5vw] pt-[5vw] pb-[5.5cqw]">{children}</div>
    </WinterNight>
  );
}

// The lobby's presents, by how many have joined: up to `upTo` players in `rows` rows of presents `width` cqw wide,
// across the 54cqw under the tree (a present and its gap are 1.1 × width).
const GIFT_TIERS = [
  { upTo: 6, rows: 1, width: 8 },
  { upTo: 14, rows: 2, width: 6.9 },
  { upTo: 27, rows: 3, width: 5.4 },
  { upTo: 44, rows: 4, width: 4.5 },
];
// Wrapping paper in the club's tile colors, each with a ribbon that shows on it.
const WRAPS = [
  ["#e0472f", "#f6efe0"],
  ["#5db760", "#e0472f"],
  ["#efc12c", "#1f6b52"],
  ["#7ec3eb", "#f6efe0"],
  ["#f49a1d", "#12332b"],
  ["#1f6b52", "#efc12c"],
  ["#c7ced0", "#e0472f"],
];
// Puffs of snow when a present lands: how far out each goes, in hundredths of its width.
const PUFFS = [-62, -34, 0, 34, 62];

type Player = { name: string };

/**
 * The TV's lobby on a winter night: the QR code on a paper card, and a big lit pine where each player who joins gets a
 * present with their name on it, dropped in from the sky in a puff of snow.
 */
export function WinterLobby({ address, code, joinUrl, roster }: { address: string; code: string; joinUrl: string; roster: Player[] }) {
  // Players with the same name keep their own presents: keyed by name and which one of that name it is.
  const seen = new Map<string, number>();
  const players = roster.map((p, i) => {
    const k = seen.get(p.name) ?? 0;
    seen.set(p.name, k + 1);
    return { ...p, key: `${p.name}#${k}`, wrap: i % WRAPS.length };
  });
  const { rows, width, more } = tieredRows(players, GIFT_TIERS);
  const shown = rows.flat();
  const per = rows[0]?.length ?? 1;
  // Presents already here when the TV opens come down one after another; after that, each as its player joins.
  const [opened, setOpened] = useState(false);
  useEffect(() => setOpened(true), []);
  return (
    <WinterNight ground="ground">
      <Tree />
      <div className="wn-card">
        <svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden>
          <path d={CARD} className="wn-fiber" transform="translate(0 -0.4)" />
          <path d={CARD} fill="#f6f1e4" />
        </svg>
        <Holly />
        <div className="relative flex h-full flex-col items-center justify-center px-[2.4cqw] text-center text-[#12332b]">
          <p className="text-[3.6cqw] leading-[0.9] font-extrabold tracking-[-0.04em]">join the game</p>
          <div className="mt-[1.4cqw] bg-white p-[0.7cqw]">
            <QRCodeSVG value={joinUrl} size={512} className="size-[17cqw]" marginSize={0} />
          </div>
          <p className="mt-[1.4cqw] text-[1.3cqw] leading-snug text-[#4f6862]">Scan, or go to</p>
          <p
            className="font-bold whitespace-nowrap text-[#12332b]"
            style={{ fontSize: `min(2cqw, ${(27 / (address.length * 0.55)).toFixed(2)}cqw)` }}
          >
            {address}
          </p>
          <p className="text-[1.3cqw] leading-snug text-[#4f6862]">and enter</p>
          <span className="mt-[0.9cqw] flex gap-[0.35cqw] text-[4.4cqw]" aria-label={`Code ${code.split("").join(" ")}`}>
            {code.split("").map((c, i) => (
              <span key={i} className="narrow wn-square">
                {c}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* One list, wrapped into rows `per` presents wide, so a present keeps its place in the DOM when the rows reflow. */}
      <ul className="wn-gifts" style={{ "--w": `${width}cqw`, "--per": per } as CSSProperties}>
        {players.length === 0 ? (
          <Gift name="waiting" wrap={3} delay={0} empty />
        ) : (
          shown.map((p, i) => <Gift key={p.key} name={p.name} wrap={p.wrap} delay={opened ? 0 : Math.min(i, 30) * 110} back={i >= per} />)
        )}
      </ul>

      <div className="absolute right-[3cqw] bottom-[0.9cqw] left-[41cqw] z-10 flex items-center gap-[2.4cqw] text-[1.5cqw] text-[#12332b]">
        <p className="font-bold">
          <span className="narrow text-[2.6cqw] font-extrabold">{roster.length}</span> player{roster.length === 1 ? "" : "s"} here
          {more > 0 && <span className="font-normal text-[#4f6862]"> · {more} more than fit</span>}
        </p>
        <p className="ml-auto flex items-center gap-[0.6cqw] font-bold">
          <InstagramGlyph className="size-[1.2em]" />
          <span className="underline decoration-[#e0472f] decoration-[0.2cqw] underline-offset-[0.4cqw]">Follow @{CLUB.instagram}</span>
        </p>
      </div>
    </WinterNight>
  );
}

const CARD = shape(
  tear(
    [
      [3, 4],
      [97, 2.5],
      [98, 117],
      [2, 118],
      [3, 4],
    ],
    1.6,
    0.45,
    110,
  ),
);

/** A sprig of holly pinned to the card's corner. */
const Holly = () => (
  <svg viewBox="0 0 100 70" className="wn-holly" aria-hidden>
    <path d="M50 40C38 20 18 22 4 30c8 2 10 8 8 14 8-4 14 0 16 6 4-6 12-8 22-10Z" fill="#1f6b52" />
    <path d="M50 40c12-20 32-18 46-10-8 2-10 8-8 14-8-4-14 0-16 6-4-6-12-8-22-10Z" fill="#2c8463" />
    <path d="M50 40C38 20 18 22 4 30M50 40c12-20 32-18 46-10" stroke="#0f3d2e" strokeWidth="1.6" fill="none" />
    <circle cx="44" cy="44" r="8" fill="#c8321f" />
    <circle cx="57" cy="45" r="8" fill="#e0472f" />
    <circle cx="50" cy="34" r="7.5" fill="#d83c25" />
    <circle cx="47" cy="31" r="2.2" fill="#fff" opacity="0.6" />
  </svg>
);

// The lobby's tree, 400 × 600: five tiers of torn paper, snow on each, a gold star on top, and lights on its swags.
const TIERS = [
  [70, 190, 66],
  [140, 270, 100],
  [215, 360, 134],
  [295, 455, 168],
  [380, 560, 198],
];
const TREE = TIERS.map(([a, b, w], i) =>
  shape(
    tear(
      [
        [200, a],
        [200 + w, b],
        [200 + w * 0.5, b - 10],
        [200, b + 6],
        [200 - w * 0.5, b - 10],
        [200 - w, b],
        [200, a],
      ],
      9,
      2.4,
      120 + i,
    ),
  ),
);
const TREE_SNOW = TIERS.map(([a, b, w], i) => {
  const at = (x: number, down: number): Pt => [200 + w * x, a + (b - a) * down];
  return shape(
    tear(
      [
        [200, a],
        at(0.46, 0.46),
        at(0.3, 0.34),
        at(0.14, 0.44),
        at(-0.04, 0.3),
        at(-0.22, 0.42),
        at(-0.36, 0.33),
        at(-0.46, 0.46),
        [200, a],
      ],
      7,
      1.6,
      130 + i,
    ),
  );
});
const TREE_LIGHTS = TIERS.flatMap(([a, b, w], t) =>
  Array.from({ length: 3 + t }, (_, j) => {
    const u = (j + 0.5) / (3 + t);
    // On a swag that droops across the tier's lower half, inside its edges.
    const y = b - 46 + 22 * Math.sin(Math.PI * u);
    return { x: 200 + (u - 0.5) * 1.7 * w * ((y - a) / (b - a)), y, c: (j + t * 2) % 5, d: -rand(j, 140 + t) * 3 };
  }),
);
const STAR = shape(
  Array.from({ length: 10 }, (_, i): Pt => [
    200 + Math.sin((i * Math.PI) / 5) * (i % 2 ? 16 : 40),
    62 - Math.cos((i * Math.PI) / 5) * (i % 2 ? 16 : 40),
  ]),
);
const BULB = ["#e0472f", "#efc12c", "#5db760", "#7ec3eb", "#f49a1d"];

function Tree() {
  return (
    <div className="wn-tree" aria-hidden>
      <svg viewBox="0 0 400 600">
        <rect x="180" y="540" width="40" height="60" fill="#5a3a22" />
        {TREE.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? "#173f32" : "#123528"} />
        ))}
        {TREE_SNOW.map((d, i) => (
          <path key={i} d={d} fill="#e9f3f0" />
        ))}
        {TREE_LIGHTS.map((l, i) => (
          <circle
            key={i}
            cx={l.x}
            cy={l.y}
            r="7"
            fill={BULB[l.c]}
            className="wn-tree-bulb"
            style={{ "--d": `${l.d}s`, "--c": BULB[l.c] } as CSSProperties}
          />
        ))}
        <path d={STAR} className="wn-star-top" />
      </svg>
    </div>
  );
}

/**
 * A player's present. It drops onto the snow `delay` ms after it mounts, in a puff of snow. When others join and the
 * rows reflow, it slides to its new place.
 */
function Gift({
  name,
  wrap,
  delay,
  back = false,
  empty = false,
}: {
  name: string;
  wrap: number;
  delay: number;
  back?: boolean;
  empty?: boolean;
}) {
  // Its delay as it mounted: one already down never drops again.
  const [at] = useState(delay);
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  const size = Math.max(0.1, Math.min(0.18, 0.66 / (longest * 0.52)));
  const ref = useRef<HTMLLIElement>(null);
  const face = useRef<HTMLParagraphElement>(null);
  useFitName(face, name, size);
  useFlip(ref);
  const [paper, ribbon] = WRAPS[wrap];
  return (
    <li
      ref={ref}
      className={`wn-gift ${back ? "wn-behind" : ""} ${empty ? "wn-empty" : ""}`}
      style={{ "--at": `${at}ms`, "--paper": paper, "--ribbon": ribbon, "--tilt": `${(rand(wrap, 150) - 0.5) * 5}deg` } as CSSProperties}
    >
      <div className="wn-drop">
        <svg viewBox="0 0 100 34" className="wn-bow" aria-hidden>
          <path d="M50 30C38 6 14 2 12 16s22 16 38 14Zm0 0C62 6 86 2 88 16S66 32 50 30Z" fill="var(--ribbon)" />
          <path d="M50 30C40 14 24 10 22 17s16 11 28 13Zm0 0c10-16 26-20 28-13S62 28 50 30Z" fill="rgb(0 0 0 / 0.16)" />
          <circle cx="50" cy="29" r="6" fill="var(--ribbon)" />
        </svg>
        <div className="wn-lid" />
        <div className="wn-box">
          <p ref={face} className="wn-tag" style={{ "--name": size } as CSSProperties}>
            <span>
              {name}
              {empty && (
                <>
                  <br />…
                </>
              )}
            </span>
          </p>
        </div>
      </div>
      {!empty && PUFFS.map((dx) => <span key={dx} className="wn-puff" style={{ "--dx": dx } as CSSProperties} aria-hidden />)}
    </li>
  );
}

// The change of screen's flats, back to front: their torn tops, 1600 wide and 400 (back) or 333 tall.
const FLAT_BACK = (() => {
  const top = (x: number) => 250 + 30 * wave(x, 1.4, 0.3);
  const f = forest(top, 30, 70, 60, 70, 0.4, 160);
  return { d: hill(400, top, 161), tree: f.tree, snow: f.snow };
})();
const FLAT_MID = hill(333, (x) => 150 + 50 * wave(x, 0.9, 2.2) + 14 * wave(x, 3.3, 1), 162);
const FLAT_FRONT = hill(333, (x) => 210 + 26 * wave(x, 1.7, 4.1) + 10 * wave(x, 4.6, 0.4), 163);

// Snowflakes out of the drift as it drops, each where its line is as it goes by: across (%), height (%), seconds in,
// size (cqw), and how far out (cqw). The same lines as the spooky night's bats.
const BURST = [
  [10, 12, 0.61, 3.6, -12],
  [22, 20, 0.58, 2.4, -8],
  [33, 10, 0.6, 3, -5],
  [44, 26, 0.62, 4.4, -2],
  [55, 14, 0.59, 2.6, 3],
  [65, 30, 0.62, 3.8, 7],
  [76, 18, 0.6, 2.8, 10],
  [88, 24, 0.57, 4, 14],
];

/** A paper snowflake: six arms, each with two pairs of branches. */
const Flake = () => (
  <svg viewBox="-50 -50 100 100" className="wn-flake">
    {[0, 60, 120].map((r) => (
      <g key={r} transform={`rotate(${r})`}>
        <path d="M0-46V46M0-30l-12-12M0-30l12-12M0-14l-10-10M0-14l10-10M0 30l-12 12M0 30l12 12M0 14l-10 10M0 14l10 10" />
      </g>
    ))}
  </svg>
);

/**
 * The winter change of screen, on the spooky night's timing (useShift): snowy stage flats rise from below, cover the
 * screen, and drop away with snowflakes bursting out of the drift. `clear` (a clock is running) sends only the
 * snowflakes, so the time is never covered.
 */
export function WinterShift({ screen, clear }: { screen: string; clear: boolean }) {
  const run = useShift(screen, clear);
  if (!run) return null;
  return (
    <div key={run.n} className={`shift wshift ${run.clear ? "shift-clear" : ""}`} aria-hidden>
      {!run.clear && (
        <div className={`absolute inset-0 ${clear ? "shift-lift" : ""}`}>
          <div className="shift-flat back">
            <svg viewBox="0 0 1600 400" preserveAspectRatio="none">
              <path d={FLAT_BACK.tree} fill="#24493f" />
              <path d={FLAT_BACK.snow} fill="#c4dad5" />
              <path d={FLAT_BACK.d} fill="var(--ink)" />
            </svg>
            <div />
          </div>
          {/* Snowy hills: a band of snow along the top, then the hill's own color the rest of the way down. */}
          {[FLAT_MID, FLAT_FRONT].map((d, i) => (
            <div key={i} className={`shift-flat ${i ? "front" : "mid"}`}>
              <svg viewBox="0 0 1600 333" preserveAspectRatio="none">
                <path d={d} fill="#eef5f3" />
                <path d={d} fill="var(--ink)" transform="translate(0 30)" />
              </svg>
              <div />
            </div>
          ))}
        </div>
      )}
      {BURST.map(([x, y, d, size, dx], i) => (
        <div key={i} className="shift-bat" style={{ "--x": `${x}%`, "--y": `${y}%`, "--d": `${d}s`, "--dx": `${dx}cqw` } as CSSProperties}>
          <div className="wn-flake-spin" style={{ "--size": `${size}cqw`, "--spin": `${i % 2 ? -1 : 1}` } as CSSProperties}>
            <Flake />
          </div>
        </div>
      ))}
    </div>
  );
}

// The join page's paper ground, behind everything, faint: far hills and pines, and the snow in front. 1600 × 300.
const JOIN_TOP = (x: number) => 190 + 30 * wave(x, 1.1, 0.8) + 12 * wave(x, 3.7, 2.4);
const JOIN = {
  far: hill(300, JOIN_TOP, 170),
  ...forest(JOIN_TOP, 28, 34, 34, 70, 0.55, 171),
  near: hill(300, (x) => 262 + 10 * wave(x, 1.8, 0.2), 172),
};

/** The join page's winter ground: pale paper hills and pines along the bottom of the window. Decoration only. */
export function JoinGround() {
  if (!useMounted()) return null;
  return (
    <svg aria-hidden viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice" className="wn-join">
      <path d={JOIN.tree} fill="#cfe1dc" />
      <path d={JOIN.snow} fill="#f5faf8" />
      <path d={JOIN.far} fill="#e4eff2" />
      <path d={JOIN.near} fill="#edf4f6" />
    </svg>
  );
}

/** The change of screen over the join page, flats only (players are reading), over the whole window. */
export function JoinShift({ screen, clear }: { screen: string; clear: boolean }) {
  return (
    <div className="join-shift">
      <WinterShift screen={screen} clear={clear} />
    </div>
  );
}

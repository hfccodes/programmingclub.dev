// Advent of Code–style puzzles: the double-points final on Code Relay and both rounds of the Final.
// Each player (or team, on Code Relay) gets its own input from a seed, solves it in any language, and types the answers in.
// Two parts per puzzle; part 2 twists part 1 and shows up once part 1 is right. Original puzzles: nothing here comes
// from Advent of Code. Convex imports this file too (to check answers), so keep it plain TypeScript with relative imports.
import type { Level } from "./types";

export interface PuzzleAnswers {
  part1: string;
  part2: string;
}

export interface Puzzle {
  name: string;
  level: Level;
  /** Minutes on the clock. */
  minutes: number;
  /** Played as a relay: one keyboard per team, drivers swap at every 2-minute chime. */
  relay?: boolean;
  /** The lineup round it belongs to, so playing that round from /host opens this puzzle. */
  slot: "preview" | "final1" | "final2";
  /** The setup, a few short sentences. `backticks` show as code. */
  story: string;
  part1: string;
  /** Shown once a team has part 1 right. */
  part2: string;
  example: string;
  /** The example's answers, exactly what solve(example) returns. */
  exampleAnswers: PuzzleAnswers;
  /** How the example gets its answers, one sentence per part. */
  exampleWhy: [string, string];
  /** A nudge per part, shown when an officer puts the hint up. */
  hint: [string, string];
  /** A short Python solution to both parts, shown after the reveal. */
  solution: string;
  /** The team's puzzle input. The same seed always gives the same input. */
  generate: (seed: number) => string;
  /** The reference answers for an input. */
  solve: (input: string) => PuzzleAnswers;
}

/** A team's seed for a puzzle on a night: the same on the server and on the team computer. */
export function puzzleSeed(sessionId: string, teamId: string, index: number) {
  let h = 2166136261;
  for (const c of `${sessionId}:${teamId}:${index}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A small seeded random number generator (mulberry32), so inputs are the same everywhere. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = int(0, i);
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  return { int, shuffle };
}

const lines = (input: string) =>
  input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Rejection sampling with a safety cap. Every generator's tests run it over hundreds of seeds. */
function until<T>(make: () => T, ok: (x: T) => boolean): T {
  for (let i = 0; i < 100_000; i++) {
    const x = make();
    if (ok(x)) return x;
  }
  throw new Error("Couldn’t generate a puzzle input.");
}

// ---- Sticker Swap (Code Relay) ---------------------------------------

const stickerPacks = (input: string) => lines(input).map((l) => l.split(/\s+/).map(Number));

/** What the stickers input guarantees, checked by the generator and the tests. */
export function stickerFacts(input: string) {
  const packs = stickerPacks(input);
  const count = new Map<number, number>();
  for (const n of packs.flat()) count.set(n, (count.get(n) ?? 0) + 1);
  return {
    packs: packs.length,
    // Packs where comparing the numbers as text picks the wrong shiny ("9" > "120").
    textTraps: packs.filter((p) => String(Math.max(...p)) !== p.map(String).reduce((a, b) => (b > a ? b : a))).length,
    // Packs with the same sticker twice.
    doubledPacks: packs.filter((p) => new Set(p).size < p.length).length,
    // Stickers found three or more times.
    triples: [...count.values()].filter((c) => c >= 3).length,
    singleDigits: packs.flat().filter((n) => n < 10).length,
  };
}

function generateStickers(seed: number) {
  const r = rng(seed);
  return until(
    () => {
      const packs = Array.from({ length: 120 }, () => Array.from({ length: r.int(3, 7) }, () => r.int(1, 250)));
      // A few packs with the same sticker twice.
      for (const p of r.shuffle([...packs.keys()]).slice(0, 4)) packs[p][r.int(1, packs[p].length - 1)] = packs[p][0];
      return packs.map((p) => p.join(" ")).join("\n");
    },
    (input) => {
      const f = stickerFacts(input);
      return f.textTraps >= 30 && f.doubledPacks >= 3 && f.triples >= 3 && f.singleDigits >= 5;
    },
  );
}

function solveStickers(input: string): PuzzleAnswers {
  const packs = stickerPacks(input);
  const seen = new Set<number>();
  let swap = 0;
  for (const n of packs.flat()) {
    if (seen.has(n)) swap += n;
    else seen.add(n);
  }
  return { part1: String(packs.reduce((s, p) => s + Math.max(...p), 0)), part2: String(swap) };
}

// ---- One Bad Bulb (the Final, puzzle 1) --------------------------------

/** How many bulbs glow when a strand is plugged in: every bulb before the first burned-out one. */
export function bulbsLit(strand: string) {
  const dud = strand.indexOf("x");
  return dud === -1 ? strand.length : dud;
}

/** What the lights input guarantees, checked by the generator and the tests. */
export function strandFacts(input: string) {
  const strands = lines(input);
  const duds = (s: string) => s.split("x").length - 1;
  return {
    strands: strands.length,
    ready: strands.filter((s) => duds(s) === 0).length,
    // Dead at the plug: nothing lights.
    deadAtPlug: strands.filter((s) => s.startsWith("x")).length,
    // Only the last bulb is out: everything else lights.
    lastOnly: strands.filter((s) => duds(s) === 1 && s.endsWith("x")).length,
    // Two or more burned-out bulbs: only the first one matters.
    severalDuds: strands.filter((s) => duds(s) >= 2).length,
    // The tempting wrong answers to part 2: every good bulb, and every bulb before the last burned-out one.
    goodBulbs: strands.reduce((n, s) => n + s.length - duds(s), 0),
    beforeLastDud: strands.reduce((n, s) => n + (duds(s) ? s.lastIndexOf("x") : s.length), 0),
  };
}

function generateStrands(seed: number) {
  const r = rng(seed);
  const bulb = () => "RGBY"[r.int(0, 3)];
  // A strand of `n` bulbs with burned-out ones at `duds`.
  const strand = (n: number, duds: number[]) => Array.from({ length: n }, (_, i) => (duds.includes(i) ? "x" : bulb())).join("");
  // Wide, so two players side by side rarely share a part 1 answer.
  const ready = r.int(14, 34);
  const deadAtPlug = r.int(5, 8);
  const lastOnly = r.int(5, 8);
  const several = r.int(20, 26);
  const box: string[] = [];
  for (let i = 0; i < 90; i++) {
    const n = r.int(6, 18);
    if (i < ready) box.push(strand(n, []));
    else if (i < ready + deadAtPlug) box.push(strand(n, r.int(0, 1) ? [0] : [0, r.int(2, n - 1)]));
    else if (i < ready + deadAtPlug + lastOnly) box.push(strand(n, [n - 1]));
    else if (i < ready + deadAtPlug + lastOnly + several)
      box.push(strand(n, r.shuffle([...Array(n - 1).keys()].slice(1)).slice(0, r.int(2, 3))));
    else box.push(strand(n, [r.int(1, n - 2)]));
  }
  return r.shuffle(box).join("\n");
}

function solveStrands(input: string): PuzzleAnswers {
  const strands = lines(input);
  return {
    part1: String(strands.filter((s) => !s.includes("x")).length),
    part2: String(strands.reduce((n, s) => n + bulbsLit(s), 0)),
  };
}

// ---- Lost Mittens (the Final, puzzle 2) --------------------------------

export const MITTEN_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
export type MittenColor = (typeof MITTEN_COLORS)[number];
export interface Mitten {
  color: string;
  hand: "left" | "right";
}

export const mittens = (input: string): Mitten[] =>
  lines(input).map((l) => {
    const [color, hand] = l.split(/\s+/);
    return { color, hand: hand === "left" ? "left" : "right" };
  });

/** Pairs when any left goes with any right, and real pairs: one left and one right of the same color. */
export function mittenPairs(box: Mitten[]) {
  const count = (hand: Mitten["hand"], color?: string) =>
    box.filter((m) => m.hand === hand && (color === undefined || m.color === color)).length;
  const colors = [...new Set(box.map((m) => m.color))].map((color) => ({
    color,
    left: count("left", color),
    right: count("right", color),
  }));
  return {
    left: count("left"),
    right: count("right"),
    colors,
    any: Math.min(count("left"), count("right")),
    matching: colors.reduce((n, c) => n + Math.min(c.left, c.right), 0),
  };
}

/** What the mittens input guarantees, checked by the generator and the tests. */
export function mittenFacts(input: string) {
  const p = mittenPairs(mittens(input));
  return {
    ...p,
    mittens: p.left + p.right,
    moreLefts: p.colors.filter((c) => c.left > c.right).length,
    moreRights: p.colors.filter((c) => c.right > c.left).length,
    // The tempting wrong answer to part 2: pairing by color and forgetting the hands.
    handless: p.colors.reduce((n, c) => n + Math.floor((c.left + c.right) / 2), 0),
  };
}

function generateMittens(seed: number) {
  const r = rng(seed);
  return until(
    () => {
      const box = MITTEN_COLORS.flatMap((color) => {
        // No color has as many lefts as rights, so the smaller count always matters.
        const few = r.int(5, 14);
        const many = few + r.int(2, 11);
        const [left, right] = r.int(0, 1) ? [few, many] : [many, few];
        return [...Array<string>(left).fill(`${color} left`), ...Array<string>(right).fill(`${color} right`)];
      });
      return r.shuffle(box).join("\n");
    },
    (input) => {
      const f = mittenFacts(input);
      // The example has fewer rights, so every input has fewer lefts: copying the example's shortcut never works.
      // Its lefts and rights differ by 3, so halving the line count gets the example wrong too, as it does every input.
      return (
        f.mittens >= 110 &&
        f.right - f.left >= 3 &&
        f.moreLefts >= 2 &&
        f.moreRights >= 2 &&
        f.any - f.matching >= 6 &&
        f.handless !== f.matching
      );
    },
  );
}

function solveMittens(input: string): PuzzleAnswers {
  const p = mittenPairs(mittens(input));
  return { part1: String(p.any), part2: String(p.matching) };
}

// ---- The deck --------------------------------------------------------------

export const PUZZLES: Puzzle[] = [
  {
    name: "sticker swap",
    level: "easy",
    minutes: 10,
    relay: true,
    slot: "preview",
    story:
      "Your team is filling the Hello, World Cup sticker album, and the packs you opened this week are everywhere. Each line of your puzzle input is one pack: the numbers on the stickers inside, separated by spaces, in the order you pulled them out.",
    part1:
      "Every pack has one shiny: the sticker with the highest number in that pack. Find the shiny in every pack and add up their numbers. What do you get?",
    part2:
      "Swap time. Go through the packs from top to bottom, and each pack from left to right. The first time you see a sticker number, it goes in the album. Every copy after that goes in your swap pile. What do the numbers in your swap pile add up to?",
    example: "4 12 9\n30 4 7 4\n12 5",
    exampleAnswers: { part1: "54", part2: "20" },
    exampleWhy: [
      "The shinies are 12, 30, and 12, and 12 + 30 + 12 = 54.",
      "The second and third 4 and the second 12 go in the swap pile, and 4 + 4 + 12 = 20.",
    ],
    hint: [
      "Turn each sticker into a number with int() before you look for the biggest one. As text, “9” beats “12”.",
      "Keep a set of the stickers you’ve seen. If a sticker is already in it, add it to the swap pile; if not, add it to the set.",
    ],
    solution: `# strip() drops a blank line at the end of the file
lines = open("input.txt").read().strip().splitlines()

# Part 1: add up the highest sticker in each pack
total = 0
for line in lines:
    stickers = [int(n) for n in line.split()]
    total += max(stickers)
print("Part 1:", total)

# Part 2: any sticker we've seen before goes in the swap pile
seen = set()
swap = 0
for line in lines:
    for n in line.split():
        n = int(n)
        if n in seen:
            swap += n
        else:
            seen.add(n)
print("Part 2:", swap)`,
    generate: generateStickers,
    solve: solveStickers,
  },
  {
    name: "one bad bulb",
    level: "easy",
    minutes: 13,
    slot: "final1",
    story:
      "Pine Street lights up tonight, and the box of lights from the club attic is one big tangle. Each line of your puzzle input is one strand, written from the plug to the far end. `R`, `G`, `B`, and `Y` are red, green, blue, and yellow bulbs. An `x` is a bulb that has burned out.",
    part1: "A strand with no burned-out bulbs can go straight up on a house. How many strands are ready to hang?",
    part2:
      "You plug in the rest anyway, and find out how old these lights are. Power runs from the plug along the wire and stops dead at the first burned-out bulb, so nothing past it lights. Plug in every strand in the box, the good ones too. How many bulbs glow?",
    example: "RGYB\nGxRY\nxBBG\nYRGxBxR\nBG\nRRYGx",
    exampleAnswers: { part1: "2", part2: "14" },
    exampleWhy: [
      "Only the first strand (RGYB) and the fifth (BG) have no x.",
      "The strands light 4, 1, 0, 3, 2, and 4 bulbs. The third is dead at the plug, and the fourth stops at its first x even though good bulbs come after it. 4 + 1 + 0 + 3 + 2 + 4 = 14.",
    ],
    hint: [
      'A strand is ready when there is no x anywhere in it. In Python, that’s: "x" not in line. Skip empty lines: an empty line has no x either.',
      "Walk along each strand one bulb at a time, adding 1 for every bulb. When you reach an x, stop walking that strand (break leaves a loop early) and start the next one.",
    ],
    solution: `ready = 0
glowing = 0
# split() also skips empty lines, so a blank line at the end doesn't count as a strand
for line in open("input.txt").read().split():
    # Part 1: no burned-out bulb anywhere on the strand
    if "x" not in line:
        ready += 1

    # Part 2: count bulbs from the plug until the first burned-out one
    for bulb in line:
        if bulb == "x":
            break
        glowing += 1

print("Part 1:", ready)
print("Part 2:", glowing)`,
    generate: generateStrands,
    solve: solveStrands,
  },
  {
    name: "lost mittens",
    level: "easy",
    minutes: 26,
    slot: "final2",
    story:
      "The rink closes for the season tonight, and the lost-and-found box by the door is overflowing with single mittens. Each line of your puzzle input is the tag on one mitten: its color, then the hand it fits, like `red left`.",
    part1:
      "The rink manager just wants the box empty, so she hands mittens out two at a time: any left with any right, whatever the colors. How many pairs can she hand out?",
    part2:
      "Nobody wants a pair that doesn’t match, so every mitten goes back in the box. A real pair is one left and one right of the same color. Starting from the full box again, how many real pairs are in it?",
    example: "red left\nblue right\nred right\ngreen left\nblue left\nred left\ngreen left\nblue right\nyellow left",
    exampleAnswers: { part1: "3", part2: "2" },
    exampleWhy: [
      "There are 6 lefts and 3 rights. Every pair needs one of each, so 3 pairs go out and 3 lefts stay behind.",
      "Red has 2 lefts and 1 right: 1 pair. Blue has 1 left and 2 rights: 1 pair. Green and yellow have only lefts, so they stay in the box. 1 + 1 = 2.",
    ],
    hint: [
      "Count the lines that end in left, and the lines that end in right. Every pair uses one of each, so the smaller count is the answer.",
      "Do part 1 once for each color: count that color’s lefts and its rights, and add the smaller number to a total. The colors are red, blue, green, yellow, purple, and orange.",
    ],
    solution: `# strip() drops a blank line at the end of the file
lines = open("input.txt").read().strip().splitlines()

# Part 1: every pair uses one left and one right
lefts = 0
rights = 0
for line in lines:
    if line.endswith("left"):
        lefts += 1
    elif line.endswith("right"):
        rights += 1
print("Part 1:", min(lefts, rights))

# Part 2: the same idea, one color at a time
pairs = 0
for color in ["red", "blue", "green", "yellow", "purple", "orange"]:
    lefts = lines.count(color + " left")
    rights = lines.count(color + " right")
    pairs += min(lefts, rights)
print("Part 2:", pairs)`,
    generate: generateMittens,
    solve: solveMittens,
  },
];

/** The puzzle a lineup round plays, e.g. "Final round, double points: Puzzle 2, medium" is the Final's second puzzle. */
export function puzzleForLabel(label: string) {
  const slot = /preview/i.test(label) ? "preview" : /puzzle 1/i.test(label) ? "final1" : /puzzle 2/i.test(label) ? "final2" : null;
  const i = PUZZLES.findIndex((p) => p.slot === slot);
  return i === -1 ? undefined : i;
}

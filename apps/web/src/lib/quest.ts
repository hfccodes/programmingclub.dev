// Snow Quest, the season Final: a top-down walk around Pine Street with coding puzzles in terminals and hidden secrets.
// Every solve, level-up, and secret gives Cup points at once. Pure TypeScript shared by the game, the practice mode in
// src/lib/quest-client.ts, and Convex (convex/quest.ts checks answers here), so keep imports relative.
import { PUZZLES } from "./puzzles";
import { answerKey } from "./grading";

export interface QuestItem {
  /** Stable id, e.g. "z1-lights". Never rename one: claims are stored by it. */
  key: string;
  kind: "puzzle" | "secret";
  /** Zone N needs level N. */
  zone: 1 | 2 | 3 | 4;
  title: string;
  xp: number;
  /** Cup points, awarded at once. */
  points: number;
  /** Plain text, `backticks` for code. May have line breaks: show it with white-space: pre-wrap. */
  story?: string;
  /** May have line breaks, and code lines indented 4 spaces: show it with white-space: pre-wrap. */
  question?: string;
  /** The player's own input. Missing when the question needs none. */
  input?: (seed: number) => string;
  example?: { input: string; answer: string; why: string };
  hint?: string;
  /** A ladder of hints for the coding puzzles, shown one at a time: the idea, then the Python for it, then nearly the
   *  whole step. The first repeats `hint`. Code lines are indented 4 spaces, like in a question. */
  hints?: string[];
  /** The line shown when a secret is found. */
  found?: string;
}

/** How long a wrong answer locks that terminal. */
export const WAIT_MS = 20_000;

/** A player's seed for the night: the same on the server and in the game. */
export function questSeed(sessionId: string, teamId: string) {
  let h = 2166136261;
  for (const c of `${sessionId}:${teamId}:quest`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A seed of its own for one input, so two puzzles never share numbers. */
function mix(seed: number, salt: string) {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of salt) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}

/** A small seeded random number generator (mulberry32). */
function ints(seed: number) {
  let a = seed >>> 0;
  return (lo: number, hi: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return lo + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * (hi - lo + 1));
  };
}

const BULBS = PUZZLES.find((p) => p.name === "one bad bulb")!;
const MITTENS = PUZZLES.find((p) => p.name === "lost mittens")!;

// ---- Inputs and their answers --------------------------------------------

/** Inches of snow on five driveways, like "4 7 2 9 5". */
export const shovelInput = (seed: number) => {
  const r = ints(mix(seed, "shovel"));
  return Array.from({ length: 5 }, () => r(2, 12)).join(" ");
};
export const solveShovel = (input: string) =>
  String(
    input
      .trim()
      .split(/\s+/)
      .map(Number)
      .reduce((a, b) => a + b, 0),
  );

/** The cocoa code's numbers: start, loop count, cups per loop. */
const cocoaNumbers = (seed: number) => {
  const r = ints(mix(seed, "cocoa"));
  return { start: r(1, 6), kids: r(3, 7), each: r(2, 4) };
};
const cocoaCode = ({ start, kids, each }: { start: number; kids: number; each: number }) =>
  `cups = ${start}\nfor kid in range(${kids}):\n    cups = cups + ${each}\nprint(cups)`;
export const cocoaInput = (seed: number) => cocoaCode(cocoaNumbers(seed));
export const solveCocoa = (seed: number) => {
  const { start, kids, each } = cocoaNumbers(seed);
  return String(start + kids * each);
};

export const bulbsInput = (seed: number) => BULBS.generate(mix(seed, "bulbs"));
export const mittensInput = (seed: number) => MITTENS.generate(mix(seed, "mittens"));

const LIGHTS_ANSWER = "14";
const NOTE = "HOT COCOA FOR ALL";
/** Each letter moved `by` places forward, wrapping Z around to A. */
export const caesar = (text: string, by: number) =>
  text.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + by + 26) % 26) + 65));
const BINARY = "110010";

/** Every answerable item's right answer for a seed. */
const ANSWERS: Record<string, (seed: number) => string> = {
  "z1-lights": () => LIGHTS_ANSWER,
  "z1-shovel": (seed) => solveShovel(shovelInput(seed)),
  "z2-cocoa": solveCocoa,
  "z2-bulbs": (seed) => BULBS.solve(bulbsInput(seed)).part1,
  "z2-note": () => NOTE,
  "z3-glow": (seed) => BULBS.solve(bulbsInput(seed)).part2,
  "z3-mittens": (seed) => MITTENS.solve(mittensInput(seed)).part1,
  "z3-clock": () => String(parseInt(BINARY, 2)),
  "z4-final": (seed) => MITTENS.solve(mittensInput(seed)).part2,
};

// ---- The world -------------------------------------------------------------

export const ITEMS: QuestItem[] = [
  // Zone 1: the square, the market, and the hidden grove
  {
    key: "z1-lights",
    kind: "puzzle",
    zone: 1,
    title: "Lamp Posts",
    xp: 100,
    points: 2,
    story:
      "Pine Street is getting ready for winter, and the first job is the lamp posts. The town's old terminal counts them with a tiny program. Read it line by line, like the computer would.",
    question: "What does this code print?\n\n    posts = 4\n    posts = posts + 3\n    print(posts * 2)",
    hint: "Go one line at a time. After the second line, posts is 4 + 3. Then print shows posts times 2.",
  },
  {
    key: "z1-shovel",
    kind: "puzzle",
    zone: 1,
    title: "Snow Day",
    xp: 100,
    points: 3,
    story: "It snowed all night. The five numbers below are how many inches of snow sit on each of the five driveways on your block.",
    question: "If you shovel all five driveways, how many inches of snow do you move?",
    input: shovelInput,
    example: { input: "3 5 1 6 2", answer: "17", why: "3 + 5 + 1 + 6 + 2 = 17." },
    hint: "Add up all five numbers. You can do it by hand, or in Python: print(3 + 5 + 1 + 6 + 2) with your numbers.",
  },
  {
    key: "z1-snowman",
    kind: "secret",
    zone: 1,
    title: "The Shy Snowman",
    xp: 100,
    points: 2,
    found: "You found the giant snowman hiding in the grove. He's been waiting all winter for someone to say hi.",
  },

  // Zone 2: the rink and the boathouse
  {
    key: "z2-cocoa",
    kind: "puzzle",
    zone: 2,
    title: "Cocoa Stand",
    xp: 150,
    points: 4,
    story:
      "The cocoa stand at the rink has a terminal that works out how many cups to make. A for loop runs the lines under it again and again: range(3) means 3 times.",
    question: "What does your code print?",
    input: cocoaInput,
    example: {
      input: cocoaCode({ start: 1, kids: 3, each: 2 }),
      answer: "7",
      why: "cups starts at 1. The loop runs 3 times and adds 2 each time: 1 + 2 + 2 + 2 = 7.",
    },
    hint: "Count how many times the loop runs (the number in range), multiply it by what gets added each time, then add the starting number.",
  },
  {
    key: "z2-bulbs",
    kind: "puzzle",
    zone: 2,
    title: "One Bad Bulb",
    xp: 150,
    points: 5,
    story:
      "The box of lights from the town hall attic is one big tangle. Each line of your list is one strand, from the plug to the far end. `R`, `G`, `B`, and `Y` are red, green, blue, and yellow bulbs. An `x` is a bulb that has burned out.",
    question: "A strand with no burned-out bulbs can go straight up on a house. How many strands are ready to hang?",
    input: bulbsInput,
    example: { input: BULBS.example, answer: BULBS.exampleAnswers.part1, why: BULBS.exampleWhy[0] },
    hint: "Too long to count by hand. Open the Python box below. Your list is already loaded: the first line of code reads it into `lines`, one strand per item.",
    hints: [
      "Too long to count by hand. Open the Python box below. Your list is already loaded: the first line of code reads it into `lines`, one strand per item.",
      "Go through the strands one at a time with a loop, and keep a count:\n\n    count = 0\n    for line in lines:\n        # check this strand here\n    print(count)",
      'To ask whether a strand has a burned-out bulb, Python has the word `in`. `"x" in line` is True when there is an x anywhere in the strand. You want the strands where that is not true:\n\n    count = 0\n    for line in lines:\n        if "x" not in line:\n            count = count + 1\n    print(count)',
    ],
  },
  {
    key: "z2-note",
    kind: "secret",
    zone: 2,
    title: "The Frozen Note",
    xp: 150,
    points: 3,
    story:
      "A note is pinned to the locked shed by the boathouse. Someone wrote it in code: every letter moved 3 places forward in the alphabet, so A became D and B became E.",
    question: `The note says: \`${caesar(NOTE, 3)}\`. What does it really say?`,
    hint: "Move each letter 3 places back. K becomes H.",
    found: "Hot cocoa for all! Someone at the stand smiles and hands you a cup.",
  },

  // Zone 3: the woods and the clearing
  {
    key: "z3-glow",
    kind: "puzzle",
    zone: 3,
    title: "Lights On",
    xp: 200,
    points: 6,
    story:
      "Time to plug in every strand from the attic box, the good ones too. It's the same list as One Bad Bulb. Power runs from the plug along the wire and stops at the first burned-out bulb, so nothing past it lights.",
    question: "Plug in every strand. How many bulbs glow?",
    input: bulbsInput,
    example: { input: BULBS.example, answer: BULBS.exampleAnswers.part2, why: BULBS.exampleWhy[1] },
    hint: "This is the same list as One Bad Bulb, but now count bulbs, not strands. For each strand: how many bulbs come before its first `x`? A strand with no `x` lights all of its bulbs.",
    hints: [
      "This is the same list as One Bad Bulb, but now count bulbs, not strands. For each strand: how many bulbs come before its first `x`? A strand with no `x` lights all of its bulbs.",
      "Use a loop inside a loop. The outer loop takes each strand. The inner loop walks along that strand one bulb at a time:\n\n    glowing = 0\n    for line in lines:\n        for bulb in line:\n            # one bulb at a time\n    print(glowing)",
      'Inside the inner loop: if the bulb is an x, stop walking this strand with `break`. Otherwise it glows, so add 1:\n\n    glowing = 0\n    for line in lines:\n        for bulb in line:\n            if bulb == "x":\n                break\n            glowing = glowing + 1\n    print(glowing)',
    ],
  },
  {
    key: "z3-mittens",
    kind: "puzzle",
    zone: 3,
    title: "Lost Mittens",
    xp: 200,
    points: 6,
    story:
      "The rink's lost-and-found box ended up at the ranger's cabin, and it is overflowing with single mittens. Each line of your list is the tag on one mitten: its color, then the hand it fits, like `red left`.",
    question:
      "The ranger just wants the box empty, and hands mittens out two at a time: any left with any right, whatever the colors. How many pairs can the ranger hand out?",
    input: mittensInput,
    example: { input: MITTENS.example, answer: MITTENS.exampleAnswers.part1, why: MITTENS.exampleWhy[0] },
    hint: "Count the lines that end in left, and the lines that end in right. Every pair uses one of each, so the smaller count is the answer.",
    hints: [
      "Count the lines that end in left, and the lines that end in right. Every pair uses one of each, so the smaller count is the answer.",
      'Each line looks like `red left`. `line.endswith("left")` is True for a left mitten:\n\n    lefts = 0\n    rights = 0\n    for line in lines:\n        if line.endswith("left"):\n            lefts = lefts + 1\n        else:\n            rights = rights + 1',
      "`min(a, b)` gives the smaller of two numbers. After the loop:\n\n    print(min(lefts, rights))",
    ],
  },
  {
    key: "z3-clock",
    kind: "secret",
    zone: 3,
    title: "The Blinking Clock",
    xp: 200,
    points: 4,
    story: `The clock tower's lights blink a number in binary, over and over: \`${BINARY}\`. A 1 is a light on, a 0 is a light off.`,
    question: "What number is it blinking?",
    hint: "From the right, the places are worth 1, 2, 4, 8, 16, and 32. Add up the places that have a 1.",
    found: "50! Pine Street turns 50 this winter, and the clock has been trying to tell everyone.",
  },

  // Zone 4: the hill and the clock tower
  {
    key: "z4-final",
    kind: "puzzle",
    zone: 4,
    title: "The Winter Festival",
    xp: 300,
    points: 12,
    story:
      "The Winter Festival starts tonight, and every kid on Pine Street needs mittens that match. Every mitten goes back in the box. It's the same list as Lost Mittens. A real pair is one left and one right of the same color.",
    question: "Starting from the full box again, how many real pairs are in it?",
    input: mittensInput,
    example: { input: MITTENS.example, answer: MITTENS.exampleAnswers.part2, why: MITTENS.exampleWhy[1] },
    hint: "Do Lost Mittens once for each color: count that color's lefts and its rights, and add the smaller number to a total. The colors are red, blue, green, yellow, purple, and orange.",
    hints: [
      "Do Lost Mittens once for each color: count that color's lefts and its rights, and add the smaller number to a total. The colors are red, blue, green, yellow, purple, and orange.",
      'Put the colors in a list and loop over them. `lines.count("red left")` counts the lines that say exactly `red left`:\n\n    for color in ["red", "blue", "green", "yellow", "purple", "orange"]:\n        lefts = lines.count(color + " left")\n        rights = lines.count(color + " right")',
      'Keep a total that starts at 0 before the loop. Inside the loop, add this color\'s smaller number to it. Print the total at the end:\n\n    pairs = 0\n    for color in ["red", "blue", "green", "yellow", "purple", "orange"]:\n        lefts = lines.count(color + " left")\n        rights = lines.count(color + " right")\n        pairs = pairs + min(lefts, rights)\n    print(pairs)',
    ],
  },
  {
    key: "z4-star",
    kind: "secret",
    zone: 4,
    title: "The Star on the Hill",
    xp: 100,
    points: 4,
    found: "You climbed to the very top of the hill. From here you can see every light on Pine Street.",
  },
];

/** xp to reach each level, and its Cup bonus. Level N opens zone N. */
export const LEVELS: { level: number; xp: number; title: string; points: number }[] = [
  { level: 1, xp: 0, title: "Newcomer", points: 0 },
  { level: 2, xp: 200, title: "Snow Shoveler", points: 2 },
  { level: 3, xp: 500, title: "Light Hanger", points: 3 },
  { level: 4, xp: 900, title: "Town Hero", points: 4 },
  { level: 5, xp: 1200, title: "Snow Legend", points: 5 },
];

export const levelFor = (xp: number) => LEVELS.reduce((lv, l) => (xp >= l.xp ? l.level : lv), 1);

export const itemByKey = (key: string) => ITEMS.find((i) => i.key === key);

/** The right answer for a seed, or null for a secret found just by reaching it. */
export const answerFor = (key: string, seed: number) => ANSWERS[key]?.(seed) ?? null;

/** Whether an answer is right. Case, spaces, and punctuation don't matter. Always true for an answerless secret. */
export function check(key: string, seed: number, answer: string) {
  const item = itemByKey(key);
  if (!item) return false;
  if (!item.question) return true;
  const want = answerFor(key, seed);
  return want !== null && answerKey(answer) !== "" && answerKey(answer) === answerKey(want);
}

/** Cup points for the level-ups between two xp totals. */
export const levelBonus = (fromXp: number, toXp: number) =>
  LEVELS.filter((l) => l.xp > fromXp && l.xp <= toXp).reduce((n, l) => n + l.points, 0);

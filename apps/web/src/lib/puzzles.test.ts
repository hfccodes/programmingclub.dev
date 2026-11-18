import { describe, expect, test } from "bun:test";
import { MITTEN_COLORS, PUZZLES, bulbsLit, mittenFacts, puzzleForLabel, puzzleSeed, stickerFacts, strandFacts } from "./puzzles";
import { WEEKS } from "./content";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Fairness: every team's input must hit the same edge cases, so check them over a couple hundred seeds.
const SEEDS = Array.from({ length: 200 }, (_, i) => puzzleSeed("session", `team${i}`, i % 3));
const atLeast = (n: number, min: number) => expect(n >= min).toBe(true);
const [stickers, bulbs, lost] = PUZZLES;

describe("every puzzle", () => {
  test("its example gives the example answers", () => {
    for (const p of PUZZLES) expect(p.solve(p.example)).toEqual(p.exampleAnswers);
  });

  test("the same seed always gives the same input, and different seeds different inputs", () => {
    for (const p of PUZZLES) {
      expect(p.generate(12345)).toBe(p.generate(12345));
      expect(new Set(SEEDS.slice(0, 20).map((s) => p.generate(s))).size).toBe(20);
    }
  });

  test("inputs are 50 to 300 lines with no blank lines, and the answers are never empty", () => {
    for (const p of PUZZLES)
      for (const seed of SEEDS.slice(0, 50)) {
        const input = p.generate(seed);
        const n = input.split("\n").length;
        atLeast(n, 50);
        atLeast(300, n);
        expect(input.split("\n").every((l) => l.trim() === l && l !== "")).toBe(true);
        const a = p.solve(input);
        expect(a.part1 !== "" && a.part2 !== "" && a.part1 !== a.part2).toBe(true);
      }
  });

  test("a trailing newline or Windows line endings don't change the answers", () => {
    for (const p of PUZZLES) {
      const input = p.generate(7);
      expect(p.solve(input.replace(/\n/g, "\r\n") + "\n")).toEqual(p.solve(input));
    }
  });

  test("seeds differ by night, team, and puzzle", () => {
    const s = puzzleSeed("a", "b", 0);
    expect(puzzleSeed("a", "b", 0)).toBe(s);
    expect(new Set([s, puzzleSeed("x", "b", 0), puzzleSeed("a", "x", 0), puzzleSeed("a", "b", 1)]).size).toBe(4);
  });

  // The published solutions, run for real, on the input as players end up saving it: as downloaded, with Windows line
  // endings, and with a blank line pasted at the end. Skipped where there's no Python.
  const python = ["python3", "python"].find((cmd) => spawnSync(cmd, ["--version"]).status === 0);
  if (python)
    test("the Python solutions print the right answers", () => {
      const dir = mkdtempSync(join(tmpdir(), "puzzle-"));
      for (const p of PUZZLES)
        for (const seed of SEEDS.slice(0, 5)) {
          const input = p.generate(seed);
          const a = p.solve(input);
          for (const saved of [input + "\n", input.replace(/\n/g, "\r\n") + "\r\n", input + "\n\n"]) {
            writeFileSync(join(dir, "input.txt"), saved);
            writeFileSync(join(dir, "solution.py"), p.solution);
            const run = spawnSync(python, ["solution.py"], { cwd: dir, encoding: "utf8" });
            expect(run.stdout).toBe(`Part 1: ${a.part1}\nPart 2: ${a.part2}\n`);
          }
        }
    });

  test("each lineup round opens its own puzzle; the Final is Snow Quest, so only Code Relay's preview is a puzzle round", () => {
    const labels = WEEKS.flatMap((w) => w.games).filter((l) => puzzleForLabel(l) !== undefined);
    expect(labels.map((l) => PUZZLES[puzzleForLabel(l)!].slot)).toEqual(["preview"]);
    // Officers can still put the old Final puzzles in a lineup by name.
    expect(["Puzzle 1: One Bad Bulb", "Puzzle 2, Lost Mittens"].map((l) => PUZZLES[puzzleForLabel(l)!].slot)).toEqual(["final1", "final2"]);
  });
});

describe("sticker swap", () => {
  test("every input has text traps, doubled packs, and repeat stickers", () => {
    for (const seed of SEEDS) {
      const f = stickerFacts(stickers.generate(seed));
      expect(f.packs).toBe(120);
      atLeast(f.textTraps, 30);
      atLeast(f.doubledPacks, 3);
      atLeast(f.triples, 3);
      atLeast(f.singleDigits, 5);
    }
  });

  test("comparing stickers as text always gets part 1 wrong", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const input = stickers.generate(seed);
      const asText = input.split("\n").reduce((s, l) => s + Number(l.split(" ").reduce((a, b) => (b > a ? b : a))), 0);
      expect(String(asText) === stickers.solve(input).part1).toBe(false);
    }
  });
});

describe("one bad bulb", () => {
  test("a strand lights up to its first burned-out bulb", () => {
    expect(["RGB", "xRGB", "RGxBxY", "RGBx", "x"].map(bulbsLit)).toEqual([3, 0, 2, 3, 0]);
  });

  test("every box has 90 strands of 6 to 18 bulbs with the same kinds of trouble", () => {
    for (const seed of SEEDS) {
      const input = bulbs.generate(seed);
      expect(input.split("\n").every((s) => /^[RGBYx]{6,18}$/.test(s))).toBe(true);
      const f = strandFacts(input);
      expect(f.strands).toBe(90);
      atLeast(f.ready, 14);
      atLeast(34, f.ready);
      atLeast(f.deadAtPlug, 5);
      atLeast(f.lastOnly, 5);
      atLeast(f.severalDuds, 20);
    }
  });

  test("counting every good bulb, or up to the last burned-out bulb, always gets part 2 wrong", () => {
    for (const seed of SEEDS) {
      const input = bulbs.generate(seed);
      const f = strandFacts(input);
      const glowing = Number(bulbs.solve(input).part2);
      atLeast(f.goodBulbs - glowing, 100);
      atLeast(f.beforeLastDud - glowing, 30);
    }
  });

  test("ready strands vary from box to box, so neighbors rarely share a part 1 answer", () => {
    atLeast(new Set(SEEDS.map((s) => bulbs.solve(bulbs.generate(s)).part1)).size, 18);
  });

  test("the example already catches both wrong ways to do part 2", () => {
    const f = strandFacts(bulbs.example);
    const glowing = Number(bulbs.exampleAnswers.part2);
    expect(f.goodBulbs === glowing || f.beforeLastDud === glowing).toBe(false);
    // Leaving out the strands with no x is wrong too.
    expect(f.deadAtPlug >= 1 && f.ready >= 1 && f.severalDuds >= 1).toBe(true);
  });
});

describe("lost mittens", () => {
  test("every tag is a color and a hand, and every color has both hands", () => {
    for (const seed of SEEDS) {
      const input = lost.generate(seed);
      expect(input.split("\n").every((l) => /^(red|blue|green|yellow|purple|orange) (left|right)$/.test(l))).toBe(true);
      const f = mittenFacts(input);
      expect(f.colors.map((c) => c.color).sort()).toEqual([...MITTEN_COLORS].sort());
      expect(f.colors.every((c) => c.left >= 5 && c.right >= 5 && c.left !== c.right)).toBe(true);
    }
  });

  test("lefts are always the scarce hand overall, but not in every color", () => {
    for (const seed of SEEDS) {
      const f = mittenFacts(lost.generate(seed));
      atLeast(f.right - f.left, 3);
      atLeast(f.moreLefts, 2);
      atLeast(f.moreRights, 2);
    }
  });

  test("ignoring color, or ignoring hands, always gets part 2 wrong", () => {
    for (const seed of SEEDS) {
      const f = mittenFacts(lost.generate(seed));
      atLeast(f.any - f.matching, 6);
      expect(f.handless === f.matching).toBe(false);
      // Counting only lefts per color (the overall scarce hand) is wrong too.
      expect(f.left === f.matching).toBe(false);
    }
  });

  test("the example already catches halving the line count and ignoring hands", () => {
    const f = mittenFacts(lost.example);
    expect(String(Math.floor(f.mittens / 2))).not.toBe(lost.exampleAnswers.part1);
    expect(String(f.handless)).not.toBe(lost.exampleAnswers.part2);
    // Halving the line count is wrong on every input too.
    for (const seed of SEEDS) {
      const g = mittenFacts(lost.generate(seed));
      expect(Math.floor(g.mittens / 2) === g.any).toBe(false);
    }
  });

  test("the solution's text counting agrees with the reference", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const input = lost.generate(seed);
      const rows = input.split("\n");
      const n = (tag: string) => rows.filter((l) => l === tag).length;
      const pairs = MITTEN_COLORS.reduce((sum, c) => sum + Math.min(n(`${c} left`), n(`${c} right`)), 0);
      expect(lost.solve(input).part2).toBe(String(pairs));
    }
  });
});

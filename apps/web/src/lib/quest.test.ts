import { describe, expect, test } from "bun:test";
import { ITEMS, LEVELS, WAIT_MS, answerFor, caesar, check, levelBonus, levelFor, questSeed } from "./quest";

const SEEDS = Array.from({ length: 200 }, (_, i) => questSeed("session", `team${i}`));
const puzzles = ITEMS.filter((i) => i.kind === "puzzle");
const secrets = ITEMS.filter((i) => i.kind === "secret");

describe("the world", () => {
  test("zones 1 to 3 have 2 puzzles then 1 secret; zone 4 has the final puzzle then 1 secret", () => {
    expect(ITEMS.map((i) => `${i.zone}${i.kind[0]}`).join(" ")).toBe("1p 1p 1s 2p 2p 2s 3p 3p 3s 4p 4s");
    expect(puzzles).toHaveLength(7);
    expect(secrets).toHaveLength(4);
  });

  test("keys are unique and the final puzzle is worth the most", () => {
    expect(new Set(ITEMS.map((i) => i.key)).size).toBe(ITEMS.length);
    const final = ITEMS.find((i) => i.zone === 4 && i.kind === "puzzle")!;
    for (const i of ITEMS) if (i !== final) expect(i.points < final.points).toBe(true);
  });

  test("every puzzle has a question and a hint; every input puzzle has a worked example", () => {
    for (const p of puzzles) {
      expect(!!p.question && !!p.hint).toBe(true);
      if (p.input) expect(!!p.example).toBe(true);
    }
    expect(puzzles.filter((p) => p.input).length >= 4).toBe(true);
  });

  test("at least two secrets need solving; the rest are found and say so", () => {
    expect(secrets.filter((s) => s.question).length >= 2).toBe(true);
    for (const s of secrets) expect(!!s.found).toBe(true);
  });
});

describe("levels", () => {
  test("start at level 1 with 0 xp and go up in order", () => {
    expect(LEVELS[0]).toEqual({ level: 1, xp: 0, title: "Newcomer", points: 0 });
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].level).toBe(i + 1);
      expect(LEVELS[i].xp > LEVELS[i - 1].xp).toBe(true);
    }
    expect(levelFor(0)).toBe(1);
    expect(levelFor(199)).toBe(1);
    expect(levelFor(200)).toBe(2);
    expect(levelFor(99999)).toBe(LEVELS.at(-1)!.level);
  });

  test("both puzzles of a zone, or one puzzle and its secret, always open the next zone, even doing the least each time", () => {
    // The least xp a player can have on reaching each zone, doing the least that opens the next.
    let least = 0;
    for (const zone of [1, 2, 3]) {
      const [a, b] = puzzles.filter((p) => p.zone === zone);
      const s = secrets.find((x) => x.zone === zone)!;
      const options = [a.xp + b.xp, a.xp + s.xp, b.xp + s.xp];
      least += Math.min(...options);
      expect(levelFor(least) >= zone + 1).toBe(true);
    }
  });

  test("no single item opens the next zone on its own", () => {
    for (const i of ITEMS.filter((x) => x.zone === 1)) expect(levelFor(i.xp)).toBe(1);
  });

  test("the level bonus counts each level crossed once", () => {
    expect(levelBonus(0, 199)).toBe(0);
    expect(levelBonus(0, 200)).toBe(2);
    expect(levelBonus(150, 550)).toBe(2 + 3);
    expect(levelBonus(200, 300)).toBe(0);
  });
});

describe("checking answers", () => {
  test("every puzzle accepts its answer on many seeds, in any case and with spaces around it", () => {
    for (const p of [...puzzles, ...secrets.filter((s) => s.question)])
      for (const seed of SEEDS) {
        const want = answerFor(p.key, seed)!;
        expect(want.length > 0).toBe(true);
        expect(check(p.key, seed, want)).toBe(true);
        expect(check(p.key, seed, `  ${want.toLowerCase()} `)).toBe(true);
      }
  });

  test("near misses, blanks, and unknown keys are wrong", () => {
    for (const p of [...puzzles, ...secrets.filter((s) => s.question)])
      for (const seed of SEEDS.slice(0, 40)) {
        const want = answerFor(p.key, seed)!;
        expect(check(p.key, seed, "")).toBe(false);
        if (/^\d+$/.test(want)) {
          expect(check(p.key, seed, String(Number(want) + 1))).toBe(false);
          expect(check(p.key, seed, String(Number(want) - 1))).toBe(false);
        } else expect(check(p.key, seed, want.slice(0, -1))).toBe(false);
      }
    expect(check("nope", 1, "1")).toBe(false);
  });

  test("secrets found by reaching them need no answer", () => {
    for (const s of secrets.filter((x) => !x.question)) expect(check(s.key, 1, "")).toBe(true);
  });

  test("input puzzles give different players different inputs and answers", () => {
    for (const p of puzzles.filter((x) => x.input)) {
      expect(p.input!(123)).toBe(p.input!(123));
      // The small hand-sized inputs repeat now and then; the real ones never do.
      const distinct = new Set(SEEDS.slice(0, 30).map((s) => p.input!(s))).size;
      expect(distinct >= (p.input!(1).includes("\n") && p.key !== "z2-cocoa" ? 30 : 20)).toBe(true);
      expect(new Set(SEEDS.map((s) => answerFor(p.key, s))).size >= 8).toBe(true);
    }
  });

  test("the hand-checked answers", () => {
    expect(answerFor("z1-lights", 1)).toBe("14");
    expect(caesar("HOT COCOA FOR ALL", 3)).toBe("KRW FRFRD IRU DOO");
    expect(check("z2-note", 1, "hot cocoa for all")).toBe(true);
    expect(check("z3-clock", 1, "50")).toBe(true);
    expect(check("z3-clock", 1, "110010")).toBe(false);
    expect(WAIT_MS).toBe(20_000);
  });

  test("worked examples give their answers", () => {
    const shovel = ITEMS.find((i) => i.key === "z1-shovel")!;
    expect(shovel.example!.answer).toBe("17");
    const cocoa = ITEMS.find((i) => i.key === "z2-cocoa")!;
    // The cocoa code is real Python: start + loops * each.
    const m = /cups = (\d+)\nfor kid in range\((\d+)\):\n {4}cups = cups \+ (\d+)/.exec(cocoa.example!.input)!;
    expect(String(+m[1] + +m[2] * +m[3])).toBe(cocoa.example!.answer);
    for (const seed of SEEDS.slice(0, 20)) {
      const n = /cups = (\d+)\nfor kid in range\((\d+)\):\n {4}cups = cups \+ (\d+)/.exec(cocoa.input!(seed))!;
      expect(answerFor("z2-cocoa", seed)).toBe(String(+n[1] + +n[2] * +n[3]));
    }
  });
});

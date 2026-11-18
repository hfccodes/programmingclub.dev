// Life for the townspeople: idle breathing, glances and hops, noticing the player, and a few short patrols.
// NPC_LIFE = false switches all of it off (everyone stands still at their post as before).
export const NPC_LIFE = true as boolean;
// NPC_PATROLS = false keeps the idle life and the spoken lines but nobody leaves their post.
export const NPC_PATROLS = true as boolean;

export interface Patrol {
  /** Waypoints as offsets in room pixels from the NPC's post (feet). The post itself is always the first stop. */
  pts: [number, number][];
  /** Walking speed, px per second. */
  speed: number;
  /** Seconds to pause at each stop, min and max. */
  pause: [number, number];
  /** Glides like a skater instead of walking. */
  ice?: boolean;
}

/** Keyed by `${roomId}:${who}`. Anyone not listed stays at their post (and still breathes, glances and notices you). */
export const PATROLS: Partial<Record<string, Patrol>> = {
  // Jax glides back and forth across the pond.
  "rink:boarder": {
    pts: [
      [-250, 10],
      [180, 50],
      [60, -80],
    ],
    speed: 150,
    pause: [1.5, 3],
    ice: true,
  },
  // Pip paces by the pines; small, so "the pines right behind me" stays true.
  "square:kid": {
    pts: [
      [-36, 28],
      [10, 40],
    ],
    speed: 55,
    pause: [2, 4],
  },
  // Bea steps between her stall and the bakery door.
  "market:baker": {
    pts: [
      [-90, 12],
      [74, 26],
    ],
    speed: 60,
    pause: [2.5, 4.5],
  },
  // Ranger Fern walks a short beat.
  "woods:ranger": {
    pts: [
      [-80, 40],
      [64, 70],
    ],
    speed: 55,
    pause: [2.5, 4],
  },
  // Professor Hoot shuffles about.
  "clearing:owl": {
    pts: [
      [70, -26],
      [-86, 56],
    ],
    speed: 45,
    pause: [3, 5],
  },
};

/** Hand-placed ambient extras per room, in room pixels (lamp glows and fires come from the occluder names). */
export const AMBIENT: Partial<
  Record<string, { smoke?: [number, number][]; star?: [number, number]; clock?: [number, number]; sky?: boolean }>
> = {
  square: {
    smoke: [
      [171, 41],
      [431, 45],
      [1102, 45],
      [1371, 47],
    ],
    star: [768, 280],
  },
  rink: { smoke: [[145, 78]] },
  clearing: { smoke: [[246, 76]] },
  tower: { clock: [776, 159] },
  hill: { sky: true },
};

/** Short spoken lines ("barks") a townsperson says when you come near, by HEROES row name. `fresh` before you've
 * talked to them or solved their thing, `thanks` after their item is solved, `any` the rest of the time. */
export const BARKS: Partial<Record<string, { fresh: string[]; thanks: string[]; any: string[] }>> = {
  electrician: {
    fresh: ["Psst! Over here, helper!", "You look like a fixer.", "Got a minute? I've got wires."],
    thanks: ["The lamps are back. Bless you.", "Lights on! You're a natural."],
    any: ["Never lick a lamp post.", "Volts, amps... it's a lot.", "I checked the tree twice today."],
  },
  kid: {
    fresh: ["Hey! Wanna know a secret?", "I built something HUGE.", "Don't tell anyone, okay?"],
    thanks: ["You found him! Did he wave?", "Best snowman ever, right?"],
    any: ["The pines look kinda thin...", "I'm not hiding anything.", "Snowball fight later?"],
  },
  baker: {
    fresh: ["Fresh bread! Come say hi!", "You look hungry. And clever."],
    thanks: ["Shovelled! Have a roll.", "You saved the bake sale!"],
    any: ["Flour everywhere. Again.", "Don't touch the cinnamon.", "Ovens on, spirits up!"],
  },
  rink: {
    fresh: ["Welcome to the rink, dear!", "Cocoa questions? Ask me."],
    thanks: ["Cocoa for everyone! Thanks!", "The cups add up now!"],
    any: ["Mind the ice, it's slippy.", "So many lost mittens...", "Skate safe, sweetie."],
  },
  boarder: {
    fresh: ["Yo! Watch this!", "Ice is FAST, dude."],
    thanks: ["Rad work, dude!"],
    any: ["Watch this! ...ow.", "Totally meant to do that.", "Gnarly ice today.", "Wheee!"],
  },
  owl: {
    fresh: ["Hoo! A visitor!", "Hoo goes there?"],
    thanks: ["Hoo-ray! Well solved.", "Splendid binary work!"],
    any: ["Count the lights. Hoo.", "Ones and zeros, dear.", "Books keep warm too."],
  },
  ranger: {
    fresh: ["Careful on the trail!", "New face in the woods?"],
    thanks: ["The woods glow again!", "Fine work out there."],
    any: ["Stay on the path.", "Fire's warm. Sit a sec.", "Owls see everything."],
  },
};

// Snow Quest's world: one painted 1536x864 room per screen, a walk grid over each painting,
// and the exits, terminals, secrets, people, and things to poke at in it. The engine reads only this file.
// Grids are drawn by looking at each painting with a numbered overlay; [col, row] everywhere.

export const ROOM_W = 1536,
  ROOM_H = 864,
  CELL = 32; // 48 x 27 cells
export type Dir = "up" | "down" | "left" | "right";
export interface Exit {
  to: string;
  cells: [number, number][];
  /** The cell in the DESTINATION room where the player appears. */
  arrive: [number, number];
  face: Dir;
  needsLevel?: number;
  hidden?: boolean;
  /** Shown when the level is too low. */
  blockedLine?: string;
}
export type Spot =
  /** painted: the terminal is already in the painting at this cell; draw only the glow, marker, and solved tick. */
  | { kind: "terminal"; at: [number, number]; item: string; painted?: true }
  | { kind: "secret"; at: [number, number]; item: string; look: "sparkle" | "note" | "invisible" }
  | {
      kind: "npc";
      at: [number, number];
      who: string;
      name: string;
      portrait?: string;
      face: Dir;
      lines: string[];
      after?: { item: string; lines: string[] };
    }
  /** An invisible hotspot over something painted. */
  | { kind: "poke"; at: [number, number]; lines: string[]; size?: [number, number] };
export interface Room {
  id: string;
  zone: 1 | 2 | 3 | 4;
  name: string;
  image: string;
  /** 27 strings of 48 characters: "." walkable, "#" blocked. */
  walk: string[];
  start?: [number, number];
  exits: Exit[];
  spots: Spot[];
}

export const COLS = ROOM_W / CELL,
  ROWS = ROOM_H / CELL;

/** Cells from (c0,r0) to (c1,r1), inclusive. */
function span(c0: number, r0: number, c1: number, r1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
  return out;
}

/** A stand-in grid until a room's painting is traced: open middle, blocked border, gaps where exits are. */
function placeholder(exits: { left?: boolean; right?: boolean; up?: boolean; down?: boolean }): string[] {
  const g = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (r < 4 || r > ROWS - 2 || c < 1 || c > COLS - 2 ? "#" : ".")),
  );
  const open = (cells: [number, number][]) => cells.forEach(([c, r]) => (g[r][c] = "."));
  if (exits.left) open(span(0, 12, 0, 15));
  if (exits.right) open(span(COLS - 1, 12, COLS - 1, 15));
  if (exits.up) open(span(22, 0, 25, 3));
  if (exits.down) open(span(22, ROWS - 1, 25, ROWS - 1));
  return g.map((row) => row.join(""));
}

// BEGIN WALK (traced from the paintings)
const WALK: Record<string, string[]> = {
  square: [
    "######################....######################",
    "######################....######################",
    "######################....######################",
    "######################....######################",
    "######################....######################",
    "######################....######################",
    "######################....######################",
    "####################........####################",
    "########...............##..................#####",
    "########.............#######............##..####",
    "############.........#######.......####.##..####",
    "############.........#######.......####.########",
    "########..........############..........########",
    "..................############..................",
    "..................############..................",
    "######............############..................",
    "######............############..........##......",
    "######............############..........########",
    "######............############..........########",
    "######............############..........########",
    "#####...#.............................##...#####",
    "#####...#.........................######...#####",
    "####..#.#.####....................######...#####",
    "####....#.########................######...#####",
    "####...###########............##################",
    "##################............##################",
    "################################################",
  ],
  market: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "######.....................................#####",
    "#####......................................#####",
    "#####......................................#####",
    "#####......................................#####",
    "...........................................#####",
    "...........................................#####",
    "...........................................#####",
    "###........................................#####",
    "###.........................................####",
    "###.........................................####",
    "###.........................................####",
    "###.........................................####",
    "###################.................############",
    "#############################.......############",
    "#############################.......############",
    "#############################.......############",
    "#############################.......############",
    "#############################.......############",
    "################################################",
  ],
  grove: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "#######..........###############......##########",
    "########.........###############.........#######",
    "########.........###############.........#######",
    "#######..........###############.........#######",
    "#######..............#######....................",
    "#######.........................................",
    "#######....................................#....",
    "########...............................#########",
    "########...............................#########",
    "########...............................#########",
    "########...............................#########",
    "########...........................#############",
    "##########.........................#############",
    "################..#..........#....##############",
    "###################..........###################",
    "################################################",
    "################################################",
    "################################################",
  ],
  rink: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "#####################........###################",
    "##############.........................#########",
    "###############.........................########",
    "###############.........................########",
    "#######..................................#######",
    "####............................................",
    "####............................................",
    "#####...........................................",
    "#####...........................................",
    "######..................................########",
    "######................................#.########",
    "######................................#.########",
    "########.........................###..##########",
    "##########.......................###.###########",
    "##############...###.....###....################",
    "####################.....#######################",
    "####################.....#######################",
    "####################.....#######################",
    "####################.....#######################",
    "####################.....#######################",
    "####################.....#######################",
  ],
  boathouse: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "############............###..###################",
    "####.........................###################",
    "#####............................###...###.#####",
    "#####......................................#####",
    "...........................................#####",
    "..........................................######",
    "..........................................######",
    "...........................................#####",
    "#####.........................................##",
    "#####.........................................##",
    "######..............................############",
    "######..............................############",
    "########............................############",
    "########............................############",
    "#############......................#############",
    "##############...............###################",
    "##############...............###################",
    "################################################",
  ],
  woods: [
    "#####################......#####################",
    "#####################......#####################",
    "#####################......#####################",
    "#####################......#####################",
    "#####################......#####################",
    "################.............###################",
    "#################............###################",
    "#################.............#########.........",
    "##############..................................",
    "##############..................................",
    "####............................................",
    "####.......................................#####",
    "####.......................................#####",
    "####.................................###########",
    "#######..............................###########",
    "#######..............................###########",
    "####.................................###########",
    "####.####..................................#####",
    "####.#######...............................#####",
    "####.#######...............................#####",
    "###############..................###############",
    "###############..................###############",
    "#################........#######################",
    "#################........#######################",
    "#################........#######################",
    "#################........#######################",
    "#################........#######################",
  ],
  clearing: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "#################............###################",
    "##########.....##............######.....########",
    "#####...................................########",
    "#####.......................................####",
    "............................................####",
    "............................................####",
    "..........................................######",
    "#######...................................######",
    "#######......................................###",
    "#######......................................###",
    "#######...............................##########",
    "#######...........###.####.###........##########",
    "#########.........###.####.###........##########",
    "#########.........###.####.###........##########",
    "################......####......################",
    "################......####......################",
    "################...............#################",
    "################################################",
  ],
  hill: [
    "####################........####################",
    "####################........####################",
    "####################........####################",
    "####################........####################",
    "####################........####################",
    "#################.................##############",
    "#################....................###########",
    "#################........................#######",
    "#############............................#######",
    "#######..........................##......#######",
    "######...........................##.....########",
    "######.....########################.....########",
    "######.....######################.......########",
    "########..###......................#############",
    "####......##....................################",
    "####......##....................################",
    "####......##....................################",
    "############.....................###############",
    "########################.........###############",
    "########################.........###############",
    "#########......##...............################",
    "#########......##............#..################",
    "#########......##............#..################",
    "##################..........####################",
    "##################..........####################",
    "##################..........####################",
    "##################..........####################",
  ],
  tower: [
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "################################################",
    "########################################...#####",
    "########################################...#####",
    "##########################################...###",
    "##########################################..####",
    "##########################################..####",
    "#####################.......##############...###",
    "########.........###........###........###...###",
    "######...........###........###........###...###",
    "#####...................................##..####",
    "#####...................................##..####",
    "####....................................##...###",
    "####..........................................##",
    "####..........................................##",
    "######....................................#...##",
    "#########.................................#...##",
    "################................################",
    "################................################",
    "################................################",
    "################................################",
    "################................################",
    "################................################",
    "################................################",
  ],
};
// END WALK

/** The traced grid, or a stand-in until the painting is traced. */
const walk = (id: string, exits: Parameters<typeof placeholder>[0]) => WALK[id] ?? placeholder(exits);

export const ROOMS: Room[] = [
  // ---------------------------------------------------------------- zone 1: Pine Street
  {
    id: "square",
    zone: 1,
    name: "Pine Street Square",
    image: "/quest/rooms/square.jpg",
    walk: walk("square", { left: true, right: true, up: true }),
    start: [24, 21],
    exits: [
      { to: "market", cells: span(47, 13, 47, 16), arrive: [3, 13], face: "right" },
      {
        to: "rink",
        cells: span(22, 0, 25, 0),
        arrive: [22, 23],
        face: "up",
        needsLevel: 2,
        blockedLine: "The bridge is roped off. A sign says: LEVEL 2 AND UP. Solve the terminals here and in the market first.",
      },
      // A thin spot in the pines, a little brighter than the rest.
      { to: "grove", cells: span(0, 13, 0, 14), arrive: [45, 14], face: "left", hidden: true },
    ],
    spots: [
      // The empty stone pad by the lamp post is where the town's terminal sits.
      { kind: "terminal", at: [6, 22], item: "z1-lights" },
      {
        kind: "npc",
        at: [16, 20],
        who: "electrician",
        name: "Volt the Electrician",
        portrait: "npc-2",
        face: "down",
        lines: [
          "Ah, a helper! I'm Volt. I keep the lights on around here. Mostly.",
          "Walk with the arrow keys or WASD. Stand next to something and press E or Space to look at it or talk.",
          "That terminal on the stone pad counts our lamp posts. Every terminal in town has a little coding puzzle. Solve it for XP.",
          "Enough XP and you level up. Level 2 opens the bridge to the rink up north. The market to the east has a terminal too.",
        ],
        after: {
          item: "z1-lights",
          lines: ["Lamp posts counted! Now the shovel job in the market, east. Then the bridge north."],
        },
      },
      {
        kind: "npc",
        at: [9, 15],
        who: "kid",
        name: "Pip",
        portrait: "npc-3",
        face: "left",
        lines: [
          "I built the biggest snowman in the whole town. Where? It's a SECRET.",
          "Okay, one hint. Look at the pine trees right behind me. See how it's brighter in one spot, like there's a gap?",
          "I didn't say walk through it. I'm just saying it's a gap.",
        ],
        after: { item: "z1-snowman", lines: ["You found him?! Did he say hi? He never says hi to me."] },
      },
      {
        kind: "poke",
        at: [21, 9],
        size: [7, 3],
        lines: ["The big tree. Every light on it works. Volt checks them twice a day. Three times on weekends."],
      },
      {
        kind: "poke",
        at: [23, 19],
        size: [3, 1],
        lines: ["Presents under the tree. Every tag says 'DO NOT OPEN UNTIL THE FESTIVAL'. One tag just says 'no'."],
      },
      {
        kind: "poke",
        at: [8, 10],
        size: [4, 2],
        lines: ["A bench. You sit down for a second.", "...", "Nice. Your legs feel ready for adventure again."],
      },
      { kind: "poke", at: [17, 7], lines: ["You knock. A voice inside yells: 'WE ALREADY HAVE A SNOW SHOVEL!'"] },
      { kind: "poke", at: [32, 7], lines: ["A note on the door: 'Gone skating. Back when the bridge opens.'"] },
      { kind: "poke", at: [34, 22], size: [4, 2], lines: ["A bench with a little plaque: 'In loving memory of summer.'"] },
      { kind: "poke", at: [24, 0], size: [2, 1], lines: ["The bridge over the frozen creek. The rink is on the other side."] },
    ],
  },
  {
    id: "market",
    zone: 1,
    name: "Winter Market",
    image: "/quest/rooms/market.jpg",
    walk: walk("market", { left: true }),
    exits: [{ to: "square", cells: span(0, 12, 0, 14), arrive: [45, 14], face: "left" }],
    spots: [
      // On the flat stone slab at the front of the market, where the snow piles up.
      { kind: "terminal", at: [31, 23], item: "z1-shovel" },
      {
        kind: "npc",
        at: [21, 9],
        who: "baker",
        name: "Bea the Baker",
        face: "down",
        lines: [
          "Welcome to the market! Mind the flour, it gets everywhere. Even in the snow. ESPECIALLY in the snow.",
          "The terminal on the stone slab wants to know how much snow got shoveled. Your INPUT is the five numbers it shows you.",
          "Everyone gets their own numbers, so you can't copy a friend. Add yours up, type the total, press Enter.",
          "Get it wrong and the terminal sulks for a bit. Just like me before coffee.",
        ],
        after: { item: "z1-shovel", lines: ["All that shoveling! Here, smell this cinnamon roll. Smelling is free."] },
      },
      { kind: "poke", at: [24, 7], size: [4, 1], lines: ["Cakes in the window. You press your nose to the glass. Very dignified."] },
      {
        kind: "poke",
        at: [18, 7],
        lines: ["The bakery door. It smells like cinnamon, butter, and a little bit of smoke. Bea says the smoke is 'a flavour'."],
      },
      { kind: "poke", at: [10, 7], lines: ["A cheese stall. One wheel is labelled 'VERY OLD'. It is looking at you."] },
      { kind: "poke", at: [33, 7], lines: ["A bag of flour. You sneeze. The whole stall sneezes back. It's a lot of flour."] },
      { kind: "poke", at: [41, 7], lines: ["Apples and oranges. You compare them. They're different. Mystery solved."] },
      { kind: "poke", at: [6, 19], lines: ["A scarf stall. One scarf is 40 feet long. 'For a giraffe,' says the sign."] },
      { kind: "poke", at: [15, 19], lines: ["Jars and pots. A tag says 'HANDMADE'. A smaller tag says 'mostly'."] },
      {
        kind: "poke",
        at: [41, 18],
        lines: ["Honey jars. A sign: ONE PER CUSTOMER. Someone has crossed it out and written 'one per BEAR'."],
      },
    ],
  },
  {
    id: "grove",
    zone: 1,
    name: "The Hidden Grove",
    image: "/quest/rooms/grove.jpg",
    walk: walk("grove", { right: true }),
    exits: [{ to: "square", cells: span(47, 13, 47, 15), arrive: [5, 14], face: "right" }],
    spots: [
      { kind: "secret", at: [24, 13], item: "z1-snowman", look: "sparkle" },
      {
        kind: "poke",
        at: [20, 13],
        lines: [
          "You whisper 'hi' to the giant snowman.",
          "'...hi,' he whispers back.",
          "You decide not to tell anyone. They wouldn't believe you anyway.",
        ],
      },
      { kind: "poke", at: [8, 8], lines: ["A snow-covered rock. Or a very lazy snowman. Hard to say."] },
      { kind: "poke", at: [39, 9], lines: ["Winter berries. Pip is saving them for the snowman's birthday. He's turning one."] },
      { kind: "poke", at: [7, 10], lines: ["A banner with a snowflake on it. Every snowflake is different. This one is mostly red."] },
      { kind: "poke", at: [7, 18], lines: ["A bench facing the snowman. You sit and admire him.", "He's very round."] },
      { kind: "poke", at: [26, 13], lines: ["A pile of spare carrots behind the rocks. Noses, just in case."] },
    ],
  },

  // ---------------------------------------------------------------- zone 2: the rink
  {
    id: "rink",
    zone: 2,
    name: "The Frozen Rink",
    image: "/quest/rooms/rink.jpg",
    walk: walk("rink", { down: true, right: true, up: true }),
    exits: [
      { to: "square", cells: span(20, 26, 24, 26), arrive: [23, 4], face: "down" },
      { to: "boathouse", cells: span(47, 11, 47, 14), arrive: [3, 15], face: "right" },
      {
        to: "woods",
        cells: span(21, 6, 28, 6),
        arrive: [21, 22],
        face: "up",
        needsLevel: 3,
        blockedLine: "A fallen tree blocks the trail. You'll need level 3 to climb over it.",
      },
    ],
    spots: [
      // On the warming hut's porch.
      { kind: "terminal", at: [8, 11], item: "z2-cocoa" },
      {
        kind: "npc",
        at: [11, 12],
        who: "rink",
        name: "Mrs. Patel",
        portrait: "npc-1",
        face: "down",
        lines: [
          "Welcome to my rink! I'm Mrs. Patel. No running, no pushing, no licking the ice. You know who you are.",
          "My cocoa terminal speaks Python. A for loop does the lines under it again and again. range(3) means three times. That's all a loop is!",
          "If a puzzle feels huge, try the example first. When you get the example's answer, do your own input the same way.",
        ],
        after: {
          item: "z2-cocoa",
          lines: ["Cocoa for everyone! The boathouse is east, past the rink. And that fallen tree up north? Level 3 and you can climb it."],
        },
      },
      {
        kind: "npc",
        at: [28, 14],
        who: "boarder",
        name: "Jax",
        face: "left",
        lines: [
          "Duuude. Ice. Is. FAST.",
          "There's a note stuck on the old shed at the boathouse. East of here. It's all scrambled letters. Probably a code, bro.",
          "The trail up north goes to the woods, but a tree fell on it. You gotta be level 3 to climb over. Or have a snowboard. I have a snowboard.",
        ],
      },
      { kind: "poke", at: [8, 9], lines: ["The warming hut. It smells like cocoa and wet socks, in that order."] },
      { kind: "poke", at: [12, 9], lines: ["Rental skates. Every pair is size 'mystery'."] },
      {
        kind: "poke",
        at: [5, 10],
        lines: [
          "A bench by the hut. You sit and lace up some imaginary skates.",
          "You do one perfect imaginary spin. Nobody saw. It counts.",
        ],
      },
      { kind: "poke", at: [33, 18], size: [3, 2], lines: ["Thin ice. A sign says DO NOT. Someone has added PLEASE underneath."] },
      { kind: "poke", at: [26, 5], lines: ["The fallen tree. A squirrel is sitting on it like it owns it now."] },
      { kind: "poke", at: [21, 14], lines: ["You try a spin on the ice.", "You do one and a half spins. The half was not on purpose."] },
    ],
  },
  {
    id: "boathouse",
    zone: 2,
    name: "The Old Boathouse",
    image: "/quest/rooms/boathouse.jpg",
    walk: walk("boathouse", { left: true }),
    exits: [{ to: "rink", cells: span(0, 13, 0, 16), arrive: [44, 12], face: "left" }],
    spots: [
      // Under the lamp post, where the strings of lights come from.
      { kind: "terminal", at: [24, 12], item: "z2-bulbs" },
      // Pinned to the locked shed door.
      { kind: "secret", at: [7, 9], item: "z2-note", look: "note" },
      {
        kind: "npc",
        at: [20, 13],
        who: "electrician",
        name: "Volt",
        portrait: "npc-2",
        face: "right",
        lines: [
          "Volt again! I followed the lights. That's my whole job, really.",
          "The box of lights from the attic is one big tangle. This input is lots of lines, so copy it into a file and loop over it, one line at a time.",
          "Each line is one strand. An x is a dead bulb. Count the strands with no x at all.",
          "Oh, and someone pinned a note on that locked shed. It's in code. Not my department.",
        ],
        after: { item: "z2-bulbs", lines: ["Good strands sorted! Up in the woods we'll find out how many actually glow."] },
      },
      { kind: "poke", at: [9, 9], lines: ["The shed's padlock is frozen solid. Whatever's inside will have to wait for spring."] },
      { kind: "poke", at: [16, 8], lines: ["The lake is frozen. A duck is standing on it, looking deeply betrayed."] },
      { kind: "poke", at: [37, 10], lines: ["Inside the boathouse is a boat called UNSINKABLE II. Nobody talks about the first one."] },
      { kind: "poke", at: [36, 21], lines: ["An upside-down rowboat. Someone has painted SEE YOU IN SPRING on it."] },
      { kind: "poke", at: [42, 14], lines: ["An axe in a stump. You leave it there. Some things are best left in stumps."] },
      { kind: "poke", at: [42, 12], lines: ["A woodpile, stacked perfectly. Ranger Fern was here. You can tell."] },
    ],
  },

  // ---------------------------------------------------------------- zone 3: the woods
  {
    id: "woods",
    zone: 3,
    name: "Lantern Woods",
    image: "/quest/rooms/woods.jpg",
    walk: walk("woods", { down: true, right: true, up: true }),
    exits: [
      { to: "rink", cells: span(17, 26, 24, 26), arrive: [25, 8], face: "down" },
      { to: "clearing", cells: span(47, 7, 47, 10), arrive: [3, 14], face: "right" },
      {
        to: "hill",
        cells: span(21, 0, 26, 0),
        arrive: [23, 24],
        face: "up",
        needsLevel: 4,
        blockedLine: "The steps up the hill are iced over. You'll need level 4 to make the climb.",
      },
    ],
    spots: [
      { kind: "terminal", at: [13, 12], item: "z3-glow" },
      {
        kind: "npc",
        at: [29, 11],
        who: "ranger",
        name: "Ranger Fern",
        face: "left",
        lines: [
          "Evening. I'm Fern, I look after these woods. Somebody wants every lantern lit.",
          "Same tangle of lights as the boathouse. This time power runs from the plug and stops at the first dead bulb. A loop with a break does exactly that.",
          "My cabin's in the clearing, east along the path. Professor Hoot lives in the big tree there. Bring a question; he loves questions.",
        ],
        after: { item: "z3-glow", lines: ["Look at that glow! The stone steps up north go to the hill, once you're strong enough."] },
      },
      { kind: "poke", at: [3, 16], lines: ["A lantern on a tree. A moth is having the best night of its life."] },
      { kind: "poke", at: [32, 7], lines: ["A lantern nailed to a big old pine. The pine does not seem to mind."] },
      { kind: "poke", at: [43, 18], lines: ["Another lantern. Fern lights all of them by hand, every night. That's a lot of lanterns."] },
      { kind: "poke", at: [6, 17], lines: ["A stump. You count the rings. 1, 2, 3... you lose count at 'lots'."] },
      { kind: "poke", at: [38, 13], lines: ["You sit on the stump. It's a very good stump.", "Five stars. Would sit again."] },
      { kind: "poke", at: [22, 15], lines: ["Footprints. Some go up, some go right. One set goes round in a circle. That was Jax."] },
    ],
  },
  {
    id: "clearing",
    zone: 3,
    name: "The Campfire Clearing",
    image: "/quest/rooms/clearing.jpg",
    walk: walk("clearing", { left: true }),
    exits: [{ to: "woods", cells: span(0, 13, 0, 15), arrive: [44, 9], face: "left" }],
    spots: [
      // Next to Fern's cabin, which doubles as the lost and found.
      { kind: "terminal", at: [17, 12], item: "z3-mittens" },
      // A book on the owl's library shelf.
      { kind: "secret", at: [37, 9], item: "z3-clock", look: "sparkle" },
      {
        kind: "npc",
        at: [33, 13],
        who: "owl",
        name: "Professor Hoot",
        portrait: "npc-4",
        face: "down",
        lines: [
          "Hoo! Welcome to my library. Mind the books, they bite. Not really. Mostly not.",
          "Fern's terminal is full of lost mittens. Lefts and rights. Count each kind and the smaller pile tells you how many pairs.",
          "And there's a book on my shelf about the clock tower. It blinks a number in binary: 1 is on, 0 is off. Go and have a read. Hoo.",
        ],
        after: { item: "z3-clock", lines: ["Fifty! A fine number. The clock tower is up the hill, past the woods. Go and see it."] },
      },
      { kind: "poke", at: [22, 20], lines: ["The campfire. You warm your hands. Somewhere, a marshmallow is ready."] },
      {
        kind: "poke",
        at: [22, 23],
        lines: ["You sit on the log by the fire.", "The fire crackles. An owl hoots. Your toes thaw out.", "Best seat in the woods."],
      },
      { kind: "poke", at: [13, 9], lines: ["Fern's cabin. A sign: BACK IN 5 MINUTES. The sign is covered in snow."] },
      { kind: "poke", at: [15, 10], lines: ["A barrel labelled MARSHMALLOWS. It's empty. There are tiny footprints around it. Pip."] },
      { kind: "poke", at: [6, 10], lines: ["Firewood, stacked by size. Then by colour. Fern has a lot of free time."] },
      {
        kind: "poke",
        at: [40, 10],
        lines: ["You knock on the round door.", "'WHO?'", "'Me.'", "'Hoo.'", "...you're not sure that went anywhere."],
      },
    ],
  },

  // ---------------------------------------------------------------- zone 4: the festival
  {
    id: "hill",
    zone: 4,
    name: "Switchback Hill",
    image: "/quest/rooms/hill.jpg",
    walk: walk("hill", { down: true, up: true }),
    exits: [
      { to: "woods", cells: span(18, 26, 27, 26), arrive: [23, 6], face: "down" },
      { to: "tower", cells: span(20, 0, 27, 0), arrive: [23, 21], face: "up" },
    ],
    spots: [
      {
        kind: "npc",
        at: [28, 15],
        who: "kid",
        name: "Pip",
        portrait: "npc-3",
        face: "left",
        lines: [
          "You made it up here too! Look, you can see the whole town from the top. There's the rink! There's my house!",
          "The big clock tower is just up the steps. The festival terminal is in front of it.",
          "My cousin says there's a sneaky path behind the tower. Round the right-hand side. I've never been brave enough.",
        ],
      },
      {
        kind: "poke",
        at: [40, 10],
        lines: ["The view. Every roof on Pine Street is wearing a snow hat. You can see the clock tower blinking."],
      },
      { kind: "poke", at: [38, 6], lines: ["A bench with a view. You sit and watch the town lights for a while.", "Worth the climb."] },
      { kind: "poke", at: [35, 5], lines: ["A barrel of road salt. Someone has written NOT SUGAR on it. Twice."] },
      { kind: "poke", at: [10, 8], lines: ["You knock. 'Is it the festival yet?' asks a voice. 'Almost,' you say. That seems to help."] },
      {
        kind: "poke",
        at: [6, 15],
        lines: ["A perfect flat patch of fresh snow. You make a snow angel.", "Ten out of ten. The judges are thrilled."],
      },
    ],
  },
  {
    id: "tower",
    zone: 4,
    name: "Clock Tower Plaza",
    image: "/quest/rooms/tower.jpg",
    walk: walk("tower", { down: true, right: true }),
    exits: [{ to: "hill", cells: span(17, 26, 30, 26), arrive: [24, 5], face: "down" }],
    spots: [
      { kind: "terminal", at: [24, 14], item: "z4-final" },
      // Up the narrow ramp on the right, behind the last house.
      { kind: "secret", at: [41, 5], item: "z4-star", look: "sparkle" },
      {
        kind: "npc",
        at: [19, 15],
        who: "owl",
        name: "Professor Hoot",
        portrait: "npc-4",
        face: "right",
        lines: [
          "Hoo! I flew. You walked. We're both here, that's what counts.",
          "The festival needs REAL pairs of mittens: one left and one right of the same colour. Same input as Lost Mittens.",
          "Do the Lost Mittens trick once for every colour, and add them all up. That's the whole thing. Hoo!",
        ],
        after: { item: "z4-final", lines: ["The Winter Festival is ON! Pine Street thanks you. Now go and find every last secret."] },
      },
      { kind: "poke", at: [24, 9], lines: ["The tower door. A sign: CLOCK REPAIR ON TUESDAYS. It is never Tuesday."] },
      {
        kind: "poke",
        at: [7, 19],
        size: [2, 1],
        lines: ["A stone plaque: PINE STREET, FOUNDED 50 YEARS AGO.", "So THAT's what the clock has been blinking."],
      },
      { kind: "poke", at: [15, 20], lines: ["A fire bowl. You warm your hands. Your mittens thank you. Both of them. They match."] },
      { kind: "poke", at: [11, 10], lines: ["You knock. Somebody yells: 'THE FESTIVAL IS TONIGHT, GO AND SOLVE IT!'"] },
      { kind: "poke", at: [24, 21], lines: ["You sit on the top step and get your breath back. That hill was a lot of hill."] },
    ],
  },
];

export const START_ROOM = "square";

export const roomById = (id: string) => ROOMS.find((r) => r.id === id);

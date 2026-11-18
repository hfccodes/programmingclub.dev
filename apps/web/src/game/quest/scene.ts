// The Phaser world: one painted room at a time (1536x864, scaled to fit), characters walking on top, exits that fade
// to the next room. Loaded in the browser only (QuestGame imports this module inside an effect).
import * as Phaser from "phaser";
import type { Bridge } from "./bridge";
import { ITEMS } from "./data";
import { HEROES } from "./heroes";
import { ICE } from "./ice";
import { AMBIENT, BARKS, NPC_LIFE, NPC_PATROLS, PATROLS } from "./life";
import type { Patrol } from "./life";
import { PLAYERS } from "./players";
import { sfx } from "./sound";
import { CELL, ROOMS, ROOM_H, ROOM_W, START_ROOM, VISITED_KEY, roomById } from "./world";
import type { Dir, Exit, Room, Spot } from "./world";

const WHERE_KEY = "quest:where:v2";
const CHAR_H = 126;
const SPEED = 250;
const DIRS: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
const FEET_W = 26;
const FEET_H = 12;
/** The feet box against the fine walk mask. */
const MASK_W = 20;
const MASK_H = 10;
/** Per-room collision and depth files, optional. Bust caches once per page load so new files are picked up. */
const ART_V = Date.now().toString(36);
const OPENED_KEY = "quest:opened:v1";
/** The player's chosen character, a PLAYERS row id (set by the picker). */
const CHAR_KEY = "hwc.quest.char";

/** An exit's chevron (only while open) and its barrier (only while locked). */
interface Gate {
  exit: Exit;
  img?: Phaser.GameObjects.Image;
  barrier?: Phaser.GameObjects.Image;
  /** Where the gate sits: the inner edge of the exit's cells. */
  gx: number;
  gy: number;
}

interface Occluder {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseY: number;
  sheet?: number;
}
interface RoomArt {
  /** 384x216, one byte per mask pixel: nonzero = walkable. */
  mask?: Uint8Array;
  occluders: Occluder[];
}
const REACH = 74;

const cellCenter = ([c, r]: [number, number]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });

interface Thing {
  spot: Spot;
  x: number;
  y: number;
  /** Blocks walking within this radius. */
  solid: number;
  sprite?: Phaser.GameObjects.Sprite;
  parts: Phaser.GameObjects.GameObject[];
  mark?: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  base?: Phaser.GameObjects.Image;
  life?: NpcLife;
}

/** A townsperson's living state: where their feet are, what they're doing. */
interface NpcLife {
  who: string;
  face: Dir;
  fx: number;
  fy: number;
  hop: number;
  noticed: boolean;
  /** The one indicator over the head: a "!" when they have something new, a typed bark, or the "E Talk" prompt. */
  bubble?: Phaser.GameObjects.Container;
  mode: "" | "bang" | "bark" | "prompt";
  bark: string;
  barkAt: number;
  lastBark: string;
  barked: boolean;
  shadow: Phaser.GameObjects.Ellipse;
  nextIdle: number;
  patrol?: Patrol;
  /** Stops, absolute room pixels; [0] is the post. */
  stops: [number, number][];
  i: number;
  waitUntil: number;
  moving: boolean;
}

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export class RoomScene extends Phaser.Scene {
  bridge!: Bridge;
  room!: Room;
  bg?: Phaser.GameObjects.Image;
  player!: Phaser.GameObjects.Sprite;
  shadow!: Phaser.GameObjects.Ellipse;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  things: Thing[] = [];
  arrows: Gate[] = [];
  /** Reveals waiting for the player to be able to see them (not behind a panel or overlay). */
  pending: { key: string; run: () => void }[] = [];
  pc = "hero";
  skatePhase = 0;
  trailDist = 0;
  /** Ambient effects in the current room (glows, embers, smoke), destroyed on leaving. */
  ambient: Phaser.GameObjects.GameObject[] = [];
  talkedHere = new Set<string>();
  /** Only one townsperson speaks at a time: nobody starts a bark before this (the current bubble plus a cooldown). */
  barkFreeAt = 0;
  ambientAt = 0;
  playersSheet = false;
  bgOpen = false;
  iceAt = 0;
  skidAt = 0;
  glideDist = 0;
  prompt!: Phaser.GameObjects.Container;
  snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  heroes = false;
  dir: Dir = "down";
  vx = 0;
  vy = 0;
  stepDist = 0;
  moving = false;
  near?: Thing;
  switching = false;
  blockedAt = 0;
  resumedAt = 0;
  savedAt = 0;
  art = new Map<string, RoomArt>();
  /** Rooms whose files were looked for, and when (a miss is retried after a while). */
  looked = new Map<string, number>();
  mask?: Uint8Array;
  occluders: Phaser.GameObjects.Image[] = [];
  debug?: Phaser.GameObjects.Graphics;
  debugMask?: Phaser.GameObjects.Image;

  constructor() {
    super("rooms");
  }

  init(data: { bridge: Bridge }) {
    this.bridge = data.bridge;
  }

  preload() {
    this.load.image("terminal", "/quest/art/terminal.png?v=2");
    this.load.spritesheet("heroes", HEROES.url, { frameWidth: HEROES.frameWidth, frameHeight: HEROES.frameHeight });
    this.load.spritesheet("players", PLAYERS.url, { frameWidth: PLAYERS.frameWidth, frameHeight: PLAYERS.frameHeight });
    this.load.image("barrier", "/quest/art/barrier.png");
    for (const r of ROOMS) {
      this.load.image(`room-${r.id}`, r.image);
      // An optional painting with the way open, used once all the room's locked exits are unlocked.
      if (r.exits.some((e) => e.needsLevel)) this.load.image(`room-${r.id}-open`, r.image.replace(/\.jpg$/, "-open.jpg"));
    }
    this.load.on("loaderror", (f: { key: string }) => {
      if (!/^(walk|fg|fg2|depth)-|-open$|^(barrier|players)$/.test(f.key)) console.warn("Snow Quest: couldn’t load", f.key);
    });
  }

  create() {
    this.heroes = this.textures.exists("heroes");
    if (this.heroes) this.textures.get("heroes").setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.playersSheet = this.textures.exists("players");
    if (this.playersSheet) {
      this.textures.get("players").setFilter(Phaser.Textures.FilterMode.LINEAR);
      for (const [row, { id }] of PLAYERS.rows.entries())
        for (const [dir, d] of Object.entries(DIRS)) {
          const b = row * PLAYERS.columns + d * 3;
          this.anims.create({
            key: `pc-${id}-${dir}`,
            frames: this.anims.generateFrameNumbers("players", { frames: [b, b + 1, b + 2, b + 1] }),
            frameRate: 7,
            repeat: -1,
          });
        }
    }
    try {
      this.pc = localStorage.getItem(CHAR_KEY) ?? "hero";
    } catch {
      // the default
    }
    this.makeTextures();
    if (this.heroes)
      for (const [row, name] of HEROES.rows.entries())
        for (const [dir, d] of Object.entries(DIRS)) {
          const b = row * HEROES.columns + d * 3;
          this.anims.create({
            key: `${name}-${dir}`,
            frames: this.anims.generateFrameNumbers("heroes", { frames: [b, b + 1, b + 2, b + 1] }),
            frameRate: 7,
            repeat: -1,
          });
        }

    this.shadow = this.add.ellipse(0, 0, 46, 14, 0x0b1030, 0.32).setDepth(1);
    this.player = this.add.sprite(0, 0, this.playerTex(), this.playerFrame("down")).setOrigin(0.5, 0.97);
    this.player.setScale(this.playerScale());
    this.prompt = this.add.container(0, 0, [this.add.image(0, 0, "keycap").setScale(0.35)]);
    this.prompt.setDepth(10_000).setVisible(false);
    this.tweens.add({ targets: this.prompt.list[0], y: -4, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    this.snow = this.add.particles(0, 0, "flake", {
      x: { min: -100, max: ROOM_W + 100 },
      y: { min: -30, max: -10 },
      lifespan: 14_000,
      speedY: { min: 35, max: 75 },
      speedX: { min: -25, max: 10 },
      scale: { min: 0.25, max: 0.9 },
      alpha: { min: 0.35, max: 0.85 },
      frequency: 90,
      quantity: 1,
    });
    this.snow.setDepth(9000);
    this.snow.fastForward(12_000);
    this.puffs = this.add.particles(0, 0, "puff", {
      lifespan: 520,
      speed: { min: 10, max: 45 },
      angle: { min: 180, max: 360 },
      scale: { start: 0.5, end: 1.1 },
      alpha: { start: 0.55, end: 0 },
      emitting: false,
    });
    this.puffs.setDepth(2);
    this.sparks = this.add.particles(0, 0, "spark", {
      lifespan: 1100,
      speed: { min: 80, max: 300 },
      angle: { min: 0, max: 360 },
      gravityY: 220,
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.sparks.setDepth(9500);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    // Not Enter: the overlays use it to continue, and a reflex Enter after closing a panel must not reopen it.
    for (const k of ["E", "SPACE"]) kb.on(`keydown-${k}`, () => this.interact());
    kb.on("keydown-BACKTICK", () => this.toggleDebug());

    this.bridge.world = {
      refresh: () => this.refresh(),
      celebrate: (n) => this.celebrate(n),
      burst: (color) => this.burst(color),
      setPaused: (p) => this.setPaused(p),
      setCharacter: (id) => this.setCharacter(id),
    };
    const cam = this.cameras.main;
    const r = this.game.registry.get("R") as number;
    cam.setZoom(r).centerOn(ROOM_W / 2, ROOM_H / 2);

    // Gates already open when the game starts don't get a show.
    try {
      const saved = localStorage.getItem(OPENED_KEY);
      if (saved) this.opened = new Set(JSON.parse(saved));
      else {
        for (const r of ROOMS) {
          for (const e of r.exits) if ((e.needsLevel ?? 0) <= this.bridge.level) this.opened.add(`${r.id}>${e.to}`);
          if (this.allOpen(r)) this.opened.add(`${r.id}>open`);
        }
        this.saveOpened();
      }
    } catch {
      // fine
    }
    // Back where the player left off.
    let where: { room: string; x: number; y: number } | null = null;
    try {
      where = JSON.parse(localStorage.getItem(WHERE_KEY) ?? "null");
    } catch {
      // first visit
    }
    const saved = where ? roomById(where.room) : undefined;
    const room = saved ?? roomById(START_ROOM) ?? ROOMS[0];
    const at = saved && where ? { x: where.x, y: where.y } : cellCenter(room.start ?? [24, 14]);
    this.enter(room, at, "down");
    this.bridge.onReady();
  }

  makeTextures() {
    const radial = (key: string, size: number, stops: [number, string][]) => {
      if (this.textures.exists(key)) return;
      const c = this.textures.createCanvas(key, size, size)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, col] of stops) g.addColorStop(o, col);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      c.refresh();
    };
    radial("flake", 16, [
      [0, "rgba(255,255,255,1)"],
      [0.5, "rgba(255,255,255,0.7)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    radial("puff", 32, [
      [0, "rgba(240,246,255,0.9)"],
      [1, "rgba(240,246,255,0)"],
    ]);
    radial("spark", 16, [
      [0, "rgba(255,255,230,1)"],
      [0.4, "rgba(255,230,150,0.8)"],
      [1, "rgba(255,200,80,0)"],
    ]);
    radial("glow", 256, [
      [0, "rgba(255,255,255,0.9)"],
      [0.35, "rgba(255,255,255,0.35)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    if (!this.textures.exists("fallback")) {
      const c = this.textures.createCanvas("fallback", ROOM_W, ROOM_H)!;
      const ctx = c.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, ROOM_H);
      g.addColorStop(0, "#5d6fae");
      g.addColorStop(0.45, "#b9c6e6");
      g.addColorStop(1, "#eef3fb");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);
      c.refresh();
    }
    if (!this.textures.exists("arrow")) {
      const c = this.textures.createCanvas("arrow", 48, 48)!;
      const ctx = c.getContext();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.strokeStyle = "rgba(34,28,51,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, 24);
      ctx.lineTo(10, 8);
      ctx.lineTo(18, 24);
      ctx.lineTo(10, 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      c.refresh();
    }
    const canvas = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const c = this.textures.createCanvas(key, w, h)!;
      draw(c.getContext());
      c.refresh();
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    // The E keycap, in the overlay's style (drawn at 2x).
    canvas("keycap", 92, 100, (ctx) => {
      ctx.fillStyle = "rgba(10,14,34,0.35)";
      ctx.beginPath();
      ctx.roundRect(8, 16, 76, 80, 16);
      ctx.fill();
      ctx.fillStyle = "#0a0e22";
      ctx.beginPath();
      ctx.roundRect(6, 8, 80, 82, 16);
      ctx.fill();
      const g = ctx.createLinearGradient(0, 6, 0, 80);
      g.addColorStop(0, "#fff1c8");
      g.addColorStop(1, "#ffd98a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(8, 4, 76, 76, 14);
      ctx.fill();
      ctx.strokeStyle = "#6b4512";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#2a1a04";
      ctx.font = "800 46px 'Atkinson Hyperlegible Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("E", 46, 44);
    });
    // Markers over terminals: a glowing gold bob, a tick once solved, a padlock while locked.
    const bob = (key: string, face: [string, string, string], draw: (ctx: CanvasRenderingContext2D) => void, glow = true) =>
      canvas(key, 120, 120, (ctx) => {
        if (glow) {
          const h = ctx.createRadialGradient(60, 60, 10, 60, 60, 60);
          h.addColorStop(0, "rgba(255,214,110,0.75)");
          h.addColorStop(1, "rgba(255,214,110,0)");
          ctx.fillStyle = h;
          ctx.fillRect(0, 0, 120, 120);
        }
        const g = ctx.createRadialGradient(52, 48, 4, 60, 60, 30);
        g.addColorStop(0, face[0]);
        g.addColorStop(0.6, face[1]);
        g.addColorStop(1, face[2]);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(60, 60, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(60,36,8,0.8)";
        ctx.stroke();
        draw(ctx);
      });
    const glyph = (t: string, color: string) => (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.font = "900 36px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t, 60, 62);
    };
    bob("bob-todo", ["#fff6d6", "#ffc95c", "#d08f2c"], glyph("!", "#2a1a04"));
    bob("bob-done", ["#fff6d6", "#ffe7a8", "#d08f2c"], glyph("✓", "#2a1a04"), false);
    bob(
      "bob-lock",
      ["#e6eaf8", "#aab4dc", "#5a6496"],
      (ctx) => {
        ctx.strokeStyle = "#141a3d";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(60, 54, 9, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#141a3d";
        ctx.beginPath();
        ctx.roundRect(46, 54, 28, 20, 4);
        ctx.fill();
      },
      false,
    );
    // Exit chevrons, soft gold.
    canvas("chevron", 96, 96, (ctx) => {
      const h = ctx.createRadialGradient(48, 48, 6, 48, 48, 48);
      h.addColorStop(0, "rgba(255,214,110,0.5)");
      h.addColorStop(1, "rgba(255,214,110,0)");
      ctx.fillStyle = h;
      ctx.fillRect(0, 0, 96, 96);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [x, a] of [
        [34, 0.55],
        [54, 1],
      ] as const) {
        ctx.strokeStyle = `rgba(107,69,18,${a})`;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(x - 8, 28);
        ctx.lineTo(x + 10, 48);
        ctx.lineTo(x - 8, 68);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,214,110,${a})`;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
    });
    const bubble = (key: string, draw: (ctx: CanvasRenderingContext2D) => void) =>
      canvas(key, 96, 92, (ctx) => {
        ctx.fillStyle = "#fbf8f1";
        ctx.strokeStyle = "#141a3d";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(8, 6, 80, 62, 22);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(38, 66);
        ctx.lineTo(48, 86);
        ctx.lineTo(58, 66);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fbf8f1";
        ctx.fillRect(40, 60, 16, 8);
        draw(ctx);
      });
    bubble("emote-bang", (ctx) => {
      ctx.fillStyle = "#d08f2c";
      ctx.font = "900 46px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 48, 39);
    });
    bubble("emote-dots", (ctx) => {
      ctx.fillStyle = "#283270";
      for (const x of [30, 48, 66]) {
        ctx.beginPath();
        ctx.arc(x, 38, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    bubble("emote-heart", (ctx) => {
      ctx.fillStyle = "#e2493f";
      ctx.beginPath();
      ctx.moveTo(48, 56);
      ctx.bezierCurveTo(20, 38, 26, 14, 48, 26);
      ctx.bezierCurveTo(70, 14, 76, 38, 48, 56);
      ctx.fill();
    });
    if (!this.textures.exists("termprop")) {
      // An old town terminal: a cream CRT on a little post, snow on top, a green prompt.
      const c = this.textures.createCanvas("termprop", 120, 140)!;
      const ctx = c.getContext();
      const round = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
      };
      ctx.fillStyle = "rgba(20,24,60,0.28)";
      ctx.beginPath();
      ctx.ellipse(60, 132, 42, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a3a4e";
      round(52, 92, 16, 40, 4);
      ctx.fill();
      const body = ctx.createLinearGradient(0, 18, 0, 100);
      body.addColorStop(0, "#f3e6c8");
      body.addColorStop(1, "#c9b48e");
      ctx.fillStyle = body;
      ctx.strokeStyle = "#3b2f45";
      ctx.lineWidth = 4;
      round(10, 22, 100, 78, 14);
      ctx.fill();
      ctx.stroke();
      const scr = ctx.createLinearGradient(0, 32, 0, 84);
      scr.addColorStop(0, "#14382f");
      scr.addColorStop(1, "#0b221d");
      ctx.fillStyle = scr;
      round(22, 32, 76, 52, 8);
      ctx.fill();
      ctx.fillStyle = "#6dffc8";
      ctx.font = "bold 24px monospace";
      ctx.fillText(">_", 32, 66);
      ctx.fillStyle = "rgba(109,255,200,0.5)";
      ctx.fillRect(66, 52, 22, 4);
      ctx.fillRect(66, 62, 14, 4);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      round(26, 35, 68, 10, 5);
      ctx.fill();
      // Snow cap.
      ctx.fillStyle = "#f8fbff";
      ctx.strokeStyle = "#b8c6e6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 30);
      ctx.bezierCurveTo(12, 12, 40, 14, 60, 16);
      ctx.bezierCurveTo(84, 12, 112, 12, 112, 30);
      ctx.bezierCurveTo(100, 26, 92, 34, 80, 28);
      ctx.bezierCurveTo(64, 34, 50, 26, 36, 30);
      ctx.bezierCurveTo(24, 34, 16, 28, 8, 30);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff8a5a";
      ctx.beginPath();
      ctx.arc(100, 92, 4, 0, Math.PI * 2);
      ctx.fill();
      c.refresh();
    }
    if (!this.textures.exists("note")) {
      const c = this.textures.createCanvas("note", 28, 22)!;
      const ctx = c.getContext();
      ctx.fillStyle = "#fbf3dc";
      ctx.strokeStyle = "#8a6a44";
      ctx.lineWidth = 2;
      ctx.fillRect(2, 2, 24, 18);
      ctx.strokeRect(2, 2, 24, 18);
      ctx.fillStyle = "#6a5a8a";
      for (const y of [7, 11, 15]) ctx.fillRect(6, y, 16, 1.5);
      c.refresh();
    }
  }

  frame(who: string, dir: Dir, f = 1) {
    const row = Math.max(0, (HEROES.rows as readonly string[]).indexOf(who));
    return row * HEROES.columns + DIRS[dir] * 3 + f;
  }

  baseScale() {
    return this.heroes ? CHAR_H / HEROES.frameHeight : 1;
  }

  // ---- The player's character ----

  playerTex() {
    return this.playersSheet ? "players" : this.heroes ? "heroes" : "__WHITE";
  }
  playerRow() {
    return this.playersSheet
      ? Math.max(
          0,
          PLAYERS.rows.findIndex((r) => r.id === this.pc),
        )
      : 0;
  }
  playerFrame(dir: Dir, f = 1) {
    return this.playerRow() * (this.playersSheet ? PLAYERS.columns : HEROES.columns) + DIRS[dir] * 3 + f;
  }
  playerAnim(dir: Dir) {
    return this.playersSheet ? `pc-${PLAYERS.rows[this.playerRow()].id}-${dir}` : `${HEROES.rows[0]}-${dir}`;
  }
  playerScale() {
    return this.playersSheet ? CHAR_H / PLAYERS.frameHeight : this.baseScale();
  }
  setCharacter(id: string) {
    this.pc = id;
    try {
      localStorage.setItem(CHAR_KEY, id);
    } catch {
      // fine
    }
    const p = this.player;
    p.anims.stop();
    p.setTexture(this.playerTex(), this.playerFrame(this.dir)).setScale(this.playerScale());
    this.puffs.explode(12, p.x, p.y - 40);
  }

  makeChar(who: string, x: number, y: number, dir: Dir) {
    const s = this.heroes ? this.add.sprite(x, y, "heroes", this.frame(who, dir)) : this.add.sprite(x, y, "__WHITE");
    if (this.heroes) s.setScale(this.baseScale());
    else s.setDisplaySize(40, CHAR_H);
    s.setOrigin(0.5, 0.97);
    return s;
  }

  setPaused(p: boolean) {
    this.bridge.paused = p;
    this.game.input.keyboard!.enabled = !p;
    this.input.keyboard!.resetKeys();
    if (!p) {
      this.resumedAt = this.time.now;
      this.flush();
    }
  }

  // ---- Rooms ----

  enter(room: Room, at: { x: number; y: number }, face: Dir) {
    this.room = room;
    this.bg?.destroy();
    for (const t of this.things) for (const p of t.parts) p.destroy();
    for (const a of this.arrows) {
      a.img?.destroy();
      a.barrier?.destroy();
    }
    this.things = [];
    this.arrows = [];
    this.pending = [];
    for (const o of this.ambient) o.destroy();
    this.ambient = [];
    this.skyRun++;
    this.talkedHere.clear();
    this.barkFreeAt = this.time.now + 600;
    this.bgOpen = this.textures.exists(`room-${room.id}-open`) && this.allOpen(room) && this.opened.has(`${room.id}>open`);
    const key = this.bgOpen ? `room-${room.id}-open` : this.textures.exists(`room-${room.id}`) ? `room-${room.id}` : "fallback";
    this.bg = this.add.image(0, 0, key).setOrigin(0).setDisplaySize(ROOM_W, ROOM_H).setDepth(-10);
    for (const spot of room.spots) this.placeSpot(spot);
    for (const exit of room.exits) this.placeExit(exit);
    this.applyArt();
    this.loadArt(room);
    const free = this.free(at.x, at.y);
    this.player.setPosition(free.x, free.y);
    this.dir = face;
    this.player.setFrame(this.playerFrame(face));
    this.vx = this.vy = 0;
    this.snow.setVisible(!/boathouse|inside|hut/.test(room.id));
    this.refresh();
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]"));
      seen.add(room.id);
      localStorage.setItem(VISITED_KEY, JSON.stringify([...seen]));
    } catch {
      // fine
    }
    this.save();
    this.bridge.onRoom(room.id);
  }

  placeSpot(spot: Spot) {
    const { x, y } = cellCenter(spot.at);
    const t: Thing = { spot, x, y, solid: 0, parts: [] };
    if (spot.kind === "terminal") {
      const painted = "painted" in spot && !!spot.painted;
      const glow = this.add
        .image(x, y - 40, "glow")
        .setTint(0x6dffc8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(y - 2);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.4, to: 0.85 },
        scale: { from: 0.75, to: 0.95 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      t.glow = glow;
      t.parts.push(glow);
      if (!painted) {
        const real = this.textures.exists("terminal");
        const img = this.add.image(x, y + 20, real ? "terminal" : "termprop").setOrigin(0.5, 1);
        img.setScale((real ? 100 : 112) / img.height).setDepth(y + 20);
        t.base = img;
        t.parts.push(img);
      }
      t.solid = 22;
      const mark = this.add
        .image(x, y - (painted ? 84 : 112), "bob-todo")
        .setScale(0.5)
        .setDepth(9600);
      this.tweens.add({ targets: mark, y: mark.y - 8, duration: 620, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: mark, scale: { from: 0.48, to: 0.56 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      t.mark = mark;
      t.parts.push(mark);
    } else if (spot.kind === "secret") {
      if (spot.look === "sparkle") {
        const s = this.add
          .image(x, y - 10, "spark")
          .setScale(1.8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(y);
        this.tweens.add({
          targets: s,
          alpha: { from: 0.15, to: 0.85 },
          scale: { from: 1.2, to: 2.2 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
        t.parts.push(s);
      } else if (spot.look === "note") {
        const n = this.add.image(x, y, "note").setDepth(y).setAngle(-8);
        this.tweens.add({ targets: n, angle: 6, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        t.parts.push(n);
      }
    } else if (spot.kind === "npc") {
      const s = this.makeChar(spot.who, x, y + 14, spot.face);
      const sh = this.add.ellipse(x, y + 12, 46, 14, 0x0b1030, 0.3).setDepth(y + 13);
      // Breathing, each out of step with the others.
      this.tweens.add({
        targets: s,
        scaleY: s.scaleY * 1.02,
        duration: 1200 + ((spot.at[0] * 37 + spot.at[1] * 53) % 700),
        delay: (spot.at[0] * 97) % 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      t.sprite = s;
      t.parts.push(s, sh);
      t.solid = 24;
      if (NPC_LIFE) {
        const patrol = REDUCED || !NPC_PATROLS ? undefined : PATROLS[`${this.room.id}:${spot.who}`];
        const fy = y + 14;
        t.life = {
          who: spot.who,
          face: spot.face,
          fx: x,
          fy,
          hop: 0,
          noticed: false,
          shadow: sh,
          nextIdle: this.time.now + 1500 + Math.random() * 4000,
          patrol,
          stops: [[x, fy], ...(patrol?.pts ?? []).map(([dx, dy]) => [x + dx, fy + dy] as [number, number])],
          i: 0,
          waitUntil: this.time.now + 2000 + Math.random() * 2000,
          moving: false,
          mode: "",
          bark: "",
          barkAt: 0,
          lastBark: "",
          barked: false,
        };
      }
    }
    this.things.push(t);
  }

  placeExit(exit: Exit) {
    const pts = exit.cells.map(cellCenter);
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const side = x < 100 ? "left" : x > ROOM_W - 100 ? "right" : y < ROOM_H / 2 ? "up" : "down";
    // The gate stands at the inner edge of the exit's cells, where the player comes from.
    const xs = exit.cells.map(([c]) => c * CELL);
    const ys = exit.cells.map(([, r]) => r * CELL);
    const gx = side === "left" ? Math.max(...xs) + CELL + 20 : side === "right" ? Math.min(...xs) - 20 : x;
    const gy = side === "up" ? Math.max(...ys) + CELL + 18 : side === "down" ? Math.min(...ys) - 4 : Math.max(...ys) + CELL;
    // Far enough into the room that the whole barrier shows.
    const g: Gate = { exit, gx: Phaser.Math.Clamp(gx, 130, ROOM_W - 130), gy: Phaser.Math.Clamp(gy, 180, ROOM_H - 12) };
    if (!exit.hidden) {
      // A small gold chevron on the ground at the very edge, under everyone.
      const angle = { left: 180, right: 0, up: -90, down: 90 }[side];
      const ax = side === "left" ? 22 : side === "right" ? ROOM_W - 22 : x;
      const ay = side === "up" ? 22 : side === "down" ? ROOM_H - 22 : y;
      const img = this.add.image(ax, ay, "chevron").setAngle(angle).setDepth(-5).setScale(0.42).setAlpha(0.7);
      this.tweens.add({ targets: img, alpha: { from: 0.45, to: 0.85 }, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const dx = Math.cos((angle * Math.PI) / 180) * 5;
      const dy = Math.sin((angle * Math.PI) / 180) * 5;
      this.tweens.add({ targets: img, x: ax + dx, y: ay + dy, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      g.img = img;
    }
    if (exit.needsLevel && this.textures.exists("barrier") && !this.opened.has(`${this.room.id}>${exit.to}`)) {
      const bar = this.add.image(g.gx, g.gy, "barrier").setOrigin(0.5, 1).setDepth(g.gy);
      bar.setScale(Math.min(1, 220 / bar.width));
      g.barrier = bar;
    }
    this.arrows.push(g);
  }

  refresh() {
    const b = this.bridge;
    for (const t of this.things) {
      const s = t.spot;
      if (s.kind === "terminal") {
        const item = ITEMS.find((i) => i.key === s.item);
        const done = b.claimed.has(s.item);
        const locked = !!item && item.zone > b.level;
        t.mark!.setTexture(done ? "bob-done" : locked ? "bob-lock" : "bob-todo").setAlpha(done ? 0.8 : 1);
        t.glow!.setVisible(!done && !locked);
        t.base?.setTint(locked ? 0x8890b0 : 0xffffff);
      } else if (s.kind === "secret" && b.claimed.has(s.item)) for (const p of t.parts) (p as Phaser.GameObjects.Image).setVisible(false);
    }
    for (const a of this.arrows) {
      const locked = (a.exit.needsLevel ?? 0) > b.level;
      const shown = !a.exit.needsLevel || this.opened.has(`${this.room.id}>${a.exit.to}`);
      a.img?.setVisible(!locked && shown);
    }
    this.checkOpenings();
  }

  /** Whether every level-locked exit of a room is unlocked now. */
  allOpen(room: Room) {
    const locked = room.exits.filter((e) => e.needsLevel);
    return locked.length > 0 && locked.every((e) => (e.needsLevel ?? 0) <= this.bridge.level);
  }

  /** Queue the reveals the player hasn't seen yet: barriers popping, a room's open painting. */
  checkOpenings() {
    const id = this.room.id;
    for (const g of this.arrows)
      if (g.exit.needsLevel && g.exit.needsLevel <= this.bridge.level && !this.opened.has(`${id}>${g.exit.to}`))
        this.queue(`${id}>${g.exit.to}`, () => this.showOpen(g));
    if (!this.bgOpen && this.allOpen(this.room) && this.textures.exists(`room-${id}-open`)) this.queue(`${id}>open`, () => this.openRoom());
  }

  queue(key: string, run: () => void) {
    if (this.pending.some((p) => p.key === key)) return;
    this.pending.push({ key, run });
    this.flush();
  }

  flush() {
    if (this.bridge.paused) return;
    const todo = this.pending;
    this.pending = [];
    todo.forEach((p, i) => this.time.delayedCall(350 + i * 500, p.run));
  }

  celebrate(_level: number) {
    this.checkOpenings();
  }

  /** A locked exit opens: its barrier pops away in a puff, a chime, the chevron appears. Shown once per gate. */
  showOpen(g: Gate) {
    if (!this.arrows.includes(g)) return;
    this.opened.add(`${this.room.id}>${g.exit.to}`);
    this.saveOpened();
    sfx.pop();
    this.cameras.main.shake(260, 0.002);
    this.puffs.explode(26, g.gx, g.gy - 40);
    this.sparks.setParticleTint(0xffe08a);
    this.sparks.explode(40, g.gx, g.gy - 60);
    const bar = g.barrier;
    g.barrier = undefined;
    if (bar)
      this.tweens.add({
        targets: bar,
        scale: bar.scale * 1.25,
        alpha: 0,
        y: bar.y - 20,
        duration: 450,
        ease: "Quad.out",
        onComplete: () => bar.destroy(),
      });
    if (g.img) {
      g.img.setVisible(true);
      this.tweens.add({ targets: g.img, scale: { from: 1, to: 0.42 }, duration: 900, ease: "Back.out" });
    }
    const label = this.add
      .text(g.gx, Phaser.Math.Clamp(g.gy - 150, 60, ROOM_H - 60), "OPEN!", {
        fontFamily: "Mona Sans, system-ui, sans-serif",
        fontSize: "34px",
        fontStyle: "900",
        color: "#ffe7a8",
        stroke: "#6b4512",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(9700)
      .setResolution(2);
    label.x = Phaser.Math.Clamp(label.x, 80, ROOM_W - 80);
    this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, delay: 1300, duration: 900, onComplete: () => label.destroy() });
  }

  /** The room's open painting replaces the closed one: a crack, snow bursting off what fell, a cross-fade. */
  openRoom() {
    const id = this.room.id;
    if (this.bgOpen || !this.textures.exists(`room-${id}-open`)) return;
    this.bgOpen = true;
    this.opened.add(`${id}>open`);
    this.saveOpened();
    sfx.crack();
    this.cameras.main.shake(500, 0.004);
    const fallen = (this.art.get(id)?.occluders ?? []).filter((o) => /fallen/i.test(o.name));
    const boxes = fallen.length
      ? fallen
      : this.arrows.filter((g) => g.exit.needsLevel).map((g) => ({ x: g.gx - 120, y: g.gy - 160, w: 240, h: 160 }));
    for (const o of boxes) for (let i = 0; i < 10; i++) this.puffs.explode(8, o.x + Math.random() * o.w, o.y + Math.random() * o.h);
    const next = this.add.image(0, 0, `room-${id}-open`).setOrigin(0).setDisplaySize(ROOM_W, ROOM_H).setDepth(-9.5).setAlpha(0);
    const old = this.bg;
    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: 700,
      delay: 150,
      onComplete: () => {
        old?.destroy();
        next.setDepth(-10);
        this.bg = next;
      },
    });
    // The fallen things' occluders fade with the painting, then go.
    for (const img of this.occluders) if (img.getData("fallen")) this.tweens.add({ targets: img, alpha: 0, duration: 700, delay: 150 });
    this.time.delayedCall(900, () => this.applyArt());
  }

  opened = new Set<string>();
  saveOpened() {
    try {
      localStorage.setItem(OPENED_KEY, JSON.stringify([...this.opened]));
    } catch {
      // fine
    }
  }

  burst(color = 0xffffff) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(46, this.player.x, this.player.y - 60);
    this.cameras.main.flash(200, 255, 248, 220, false);
  }

  save() {
    try {
      localStorage.setItem(WHERE_KEY, JSON.stringify({ room: this.room.id, x: Math.round(this.player.x), y: Math.round(this.player.y) }));
    } catch {
      // fine
    }
  }

  // ---- Walking ----

  cellBlocked(c: number, r: number) {
    if (c < 0 || r < 0 || c >= ROOM_W / CELL || r >= ROOM_H / CELL) return true;
    return this.room.walk[r]?.[c] === "#";
  }

  exitAt(c: number, r: number) {
    return this.room.exits.find((e) => e.cells.some(([ec, er]) => ec === c && er === r));
  }

  /** Whether the feet box at (x, y) hits a wall, a person or a terminal. */
  blocked(x: number, y: number) {
    if (this.mask) return this.maskBlocked(x, y) || this.thingBlocked(x, y);
    const x0 = Math.floor((x - FEET_W / 2) / CELL);
    const x1 = Math.floor((x + FEET_W / 2) / CELL);
    const y0 = Math.floor((y - FEET_H) / CELL);
    const y1 = Math.floor(y / CELL);
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) if (this.cellBlocked(c, r) && !this.exitAt(c, r)) return true;
    return this.thingBlocked(x, y);
  }

  /** Terminals and people block a tight ellipse around their feet. */
  thingBlocked(x: number, y: number) {
    for (const t of this.things) {
      if (!t.solid) continue;
      // A terminal's footprint is its base, wide and shallow; a person's is a tight ellipse round the feet.
      if (t.spot.kind === "terminal") {
        if (((t.x - x) / 42) ** 2 + ((t.y + 8 - y) / 18) ** 2 < 1) return true;
      } else if (Math.hypot(t.x - x, t.y + 14 - y) < t.solid) return true;
    }
    return false;
  }

  /** The feet box against the fine mask. Inside an exit's cells the mask is ignored, so edges always lead out. */
  maskBlocked(x: number, y: number) {
    const m = this.mask!;
    const x0 = Math.floor((x - MASK_W / 2) / 4);
    const x1 = Math.floor((x + MASK_W / 2) / 4);
    const y0 = Math.floor((y - MASK_H) / 4);
    const y1 = Math.floor(y / 4);
    for (let my = y0; my <= y1; my++)
      for (let mx = x0; mx <= x1; mx++) {
        if (mx < 0 || my < 0 || mx >= 384 || my >= 216) {
          if (!this.exitAt(Math.floor((mx * 4) / CELL), Math.floor((my * 4) / CELL))) return true;
          continue;
        }
        if (!m[my * 384 + mx] && !this.exitAt(Math.floor((mx * 4) / CELL), Math.floor((my * 4) / CELL))) return true;
      }
    return false;
  }

  // ---- Per-room collision mask and occluders ----

  loadArt(room: Room) {
    const id = room.id;
    const last = this.looked.get(id);
    if (this.art.has(id) || (last !== undefined && Date.now() - last < 20_000)) return;
    this.looked.set(id, Date.now());
    const base = `/quest/rooms/${id}`;
    const keys = { walk: `walk-${id}`, fg: `fg-${id}`, fg2: `fg2-${id}`, depth: `depth-${id}` };
    for (const k of Object.values(keys)) if (this.textures.exists(k)) this.textures.remove(k);
    this.load.image(keys.walk, `${base}.walk.png?v=${ART_V}`);
    this.load.image(keys.fg, `${base}.fg.png?v=${ART_V}`);
    this.load.image(keys.fg2, `${base}.fg2.png?v=${ART_V}`);
    this.load.json(keys.depth, `${base}.depth.json?v=${ART_V}`);
    this.load.once("complete", () => {
      const art: RoomArt = { occluders: [] };
      if (this.textures.exists(keys.walk)) {
        const img = this.textures.get(keys.walk).getSourceImage() as HTMLImageElement;
        const c = document.createElement("canvas");
        c.width = 384;
        c.height = 216;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 384, 216);
        const px = ctx.getImageData(0, 0, 384, 216).data;
        const mask = new Uint8Array(384 * 216);
        for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
        art.mask = mask;
      }
      const depth = this.cache.json.get(keys.depth) as { occluders?: Occluder[] } | undefined;
      if (depth?.occluders) art.occluders = depth.occluders;
      // Keep only what loaded; a room with nothing is looked for again later.
      if (art.mask || art.occluders.length) this.art.set(id, art);
      if (this.room.id === id) {
        this.applyArt();
        const p = this.player;
        const free = this.free(p.x, p.y);
        p.setPosition(free.x, free.y);
      }
    });
    this.load.start();
  }

  applyArt() {
    for (const o of this.occluders) o.destroy();
    this.occluders = [];
    const art = this.art.get(this.room.id);
    this.mask = art?.mask;
    for (const o of art?.occluders ?? []) {
      const key = `${o.sheet === 2 ? "fg2" : "fg"}-${this.room.id}`;
      if (!this.textures.exists(key)) continue;
      // The whole sheet at the room's origin, cropped to this object, so pixels line up with the painting.
      const fallen = /fallen/i.test(o.name);
      if (fallen && this.bgOpen) continue;
      const img = this.add.image(0, 0, key).setOrigin(0).setCrop(o.x, o.y, o.w, o.h).setDepth(o.baseY).setData("fallen", fallen);
      this.occluders.push(img);
    }
    if (this.debug) this.drawDebugMask();
    this.makeAmbient();
  }

  // ---- Ambient life: lamp glows breathing, fire and embers, chimney smoke, the star, a second snow layer ----

  makeAmbient() {
    for (const o of this.ambient) o.destroy();
    this.ambient = [];
    if (!NPC_LIFE) return;
    const id = this.room.id;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.ambient.push(o), o);
    const pulse = (o: Phaser.GameObjects.Image, from: number, to: number, ms: number) => {
      if (!REDUCED)
        this.tweens.add({
          targets: o,
          alpha: { from, to },
          duration: ms,
          delay: Math.random() * ms,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
    };
    for (const o of this.art.get(id)?.occluders ?? []) {
      const n = o.name.toLowerCase();
      if (/fallen/.test(n)) continue;
      if (/campfire|brazier/.test(n)) {
        const fx = o.x + o.w / 2;
        const fy = o.y + o.h * (n.includes("campfire") ? 0.45 : 0.3);
        const g = add(
          this.add
            .image(fx, fy, "glow")
            .setTint(0xff9a40)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(o.baseY + 0.5),
        );
        g.setScale(n.includes("campfire") ? 1.5 : 0.9).setAlpha(0.6);
        if (!REDUCED) {
          this.tweens.add({
            targets: g,
            alpha: { from: 0.4, to: 0.75 },
            scale: g.scale * 1.1,
            duration: 140 + Math.random() * 120,
            yoyo: true,
            repeat: -1,
          });
          add(
            this.add
              .particles(fx, fy, "spark", {
                x: { min: -o.w * 0.2, max: o.w * 0.2 },
                lifespan: { min: 900, max: 1700 },
                speedY: { min: -90, max: -40 },
                speedX: { min: -14, max: 14 },
                scale: { start: 0.55, end: 0 },
                tint: 0xffb050,
                blendMode: Phaser.BlendModes.ADD,
                frequency: n.includes("campfire") ? 120 : 260,
              })
              .setDepth(o.baseY + 0.6),
          );
        }
      } else if (/lamp|lantern/.test(n) && !/tree|bush|fence|plot/.test(n)) {
        // A warm pool round the lamp head.
        const g = add(
          this.add
            .image(o.x + o.w / 2, o.y + Math.min(26, o.h * 0.16), "glow")
            .setTint(0xffc870)
            .setBlendMode(Phaser.BlendModes.ADD),
        );
        g.setDepth(o.baseY + 0.5)
          .setScale(0.6)
          .setAlpha(0.35);
        pulse(g, 0.22, 0.48, 1400 + Math.random() * 1200);
      }
    }
    const extra = AMBIENT[id];
    for (const [x, y] of extra?.smoke ?? [])
      if (!REDUCED)
        add(
          this.add
            .particles(x, y, "puff", {
              lifespan: 4200,
              speedY: { min: -26, max: -14 },
              speedX: { min: 4, max: 16 },
              scale: { start: 0.5, end: 2.2 },
              alpha: { start: 0.32, end: 0 },
              frequency: 650,
            })
            .setDepth(5),
        );
    if (extra?.star) {
      const st = add(
        this.add
          .image(extra.star[0], extra.star[1], "glow")
          .setTint(0xffe7a8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.45)
          .setDepth(600),
      );
      if (!REDUCED)
        this.tweens.add({
          targets: st,
          scale: { from: 0.35, to: 0.6 },
          alpha: { from: 0.5, to: 0.95 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
    }
    if (extra?.clock) {
      const c = add(
        this.add
          .image(extra.clock[0], extra.clock[1], "glow")
          .setTint(0xfff0b0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(0.6)
          .setDepth(5),
      );
      pulse(c, 0.3, 0.6, 2200);
    }
    if (REDUCED) return;
    // A second, slower and smaller layer of snow, for depth.
    if (this.snow.visible)
      add(
        this.add
          .particles(0, 0, "flake", {
            x: { min: -100, max: ROOM_W + 100 },
            y: { min: -30, max: -10 },
            lifespan: 22_000,
            speedY: { min: 18, max: 32 },
            speedX: { min: -12, max: 6 },
            scale: { min: 0.15, max: 0.4 },
            alpha: { min: 0.25, max: 0.55 },
            frequency: 160,
          })
          .setDepth(8990),
      ).fastForward(15_000);
    if (extra?.sky) this.shootingStar(++this.skyRun);
  }

  skyRun = 0;
  shootingStar(run: number) {
    this.time.delayedCall(6000 + Math.random() * 8000, () => {
      if (run !== this.skyRun || !this.scene.isActive()) return;
      const x = 300 + Math.random() * 900;
      const st = this.add
        .image(x, 30 + Math.random() * 60, "spark")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.4, 0.5)
        .setAngle(20)
        .setDepth(-4);
      this.ambient.push(st);
      this.tweens.add({
        targets: st,
        x: x + 260,
        y: st.y + 95,
        alpha: { from: 1, to: 0 },
        duration: 900,
        ease: "Quad.in",
        onComplete: () => st.destroy(),
      });
      this.shootingStar(run);
    });
  }

  /** Sparkles that come and go on the ice. */
  iceSparkle() {
    const polys = this.icePolys.get(this.room.id);
    if (!polys?.length || REDUCED || !NPC_LIFE) return;
    const b = polys[0].points;
    const xs = b.map((p) => p.x);
    const ys = b.map((p) => p.y);
    for (let k = 0; k < 8; k++) {
      const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
      const y = Math.min(...ys) + Math.random() * (Math.max(...ys) - Math.min(...ys));
      if (!polys[0].contains(x, y)) continue;
      const sp = this.add.image(x, y, "spark").setBlendMode(Phaser.BlendModes.ADD).setDepth(-4).setScale(0.2).setAlpha(0);
      this.ambient.push(sp);
      this.tweens.add({ targets: sp, alpha: 0.9, scale: 1.1, duration: 380, yoyo: true, onComplete: () => sp.destroy() });
      return;
    }
  }

  toggleDebug() {
    if (this.debug) {
      this.debug.destroy();
      this.debugMask?.destroy();
      this.debug = this.debugMask = undefined;
      return;
    }
    this.debug = this.add.graphics().setDepth(9900);
    this.drawDebugMask();
  }

  /** Blocked ground tinted red (the fine mask, or the coarse grid without one). */
  drawDebugMask() {
    this.debugMask?.destroy();
    const key = `debugmask-${this.room.id}-${this.mask ? "m" : "g"}`;
    if (!this.textures.exists(key)) {
      const c = this.textures.createCanvas(key, 384, 216)!;
      const ctx = c.getContext();
      const img = ctx.createImageData(384, 216);
      for (let y = 0; y < 216; y++)
        for (let x = 0; x < 384; x++) {
          const open = this.mask
            ? this.mask[y * 384 + x]
            : this.room.walk[Math.floor((y * 4) / CELL)]?.[Math.floor((x * 4) / CELL)] !== "#";
          const i = (y * 384 + x) * 4;
          img.data[i] = 255;
          img.data[i + 1] = 40;
          img.data[i + 2] = 60;
          img.data[i + 3] = open ? 0 : 110;
        }
      ctx.putImageData(img, 0, 0);
      c.refresh();
    }
    this.debugMask = this.add.image(0, 0, key).setOrigin(0).setScale(4).setDepth(9890);
  }

  drawDebug() {
    const g = this.debug!;
    g.clear();
    const art = this.art.get(this.room.id);
    for (const o of art?.occluders ?? []) {
      g.lineStyle(2, o.sheet === 2 ? 0x66ccff : 0xffd65a, 0.9).strokeRect(o.x, o.y, o.w, o.h);
      g.lineStyle(2, 0xff5aa0, 1).lineBetween(o.x - 6, o.baseY, o.x + o.w + 6, o.baseY);
    }
    for (const e of this.room.exits) for (const [c, r] of e.cells) g.fillStyle(0x5ab4ff, 0.25).fillRect(c * CELL, r * CELL, CELL, CELL);
    const p = this.player;
    const w = this.mask ? MASK_W : FEET_W;
    const h = this.mask ? MASK_H : FEET_H;
    g.lineStyle(2, 0x00ff88, 1).strokeRect(p.x - w / 2, p.y - h, w, h);
    for (const t of this.things)
      if (t.spot.kind === "terminal") g.lineStyle(1, 0xffffff, 0.8).strokeEllipse(t.x, t.y + 8, 84, 36);
      else if (t.solid) g.lineStyle(1, 0xffffff, 0.8).strokeEllipse(t.x, t.y + 14, t.solid * 2, t.solid);
  }

  /** The nearest spot to (x, y) where the player can stand, so a stale save or a bad arrival never traps anyone. */
  free(x: number, y: number) {
    if (!this.blocked(x, y)) return { x, y };
    for (let d = 1; d < 30; d++)
      for (let dy = -d; dy <= d; dy++)
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const c = Math.floor(x / CELL) + dx;
          const r = Math.floor(y / CELL) + dy;
          const px = c * CELL + CELL / 2;
          const py = r * CELL + CELL / 2;
          if (!this.blocked(px, py) && !this.exitAt(c, r)) return { x: px, y: py };
        }
    return { x, y };
  }

  /** Townspeople breathe, glance, hop, notice you, and a few walk short beats. Cheap: a few NPCs, simple math. */
  liveNpcs(dt: number, paused: boolean) {
    const p = this.player;
    const now = this.time.now;
    // Only the townsperson nearest the player may start speaking.
    let nearestLife: NpcLife | undefined;
    let nearestD = Infinity;
    for (const t of this.things) {
      if (!t.life) continue;
      const nd = Math.hypot(p.x - t.life.fx, p.y - t.life.fy);
      if (nd < nearestD) {
        nearestD = nd;
        nearestLife = t.life;
      }
    }
    for (const t of this.things) {
      const L = t.life;
      const s = t.spot;
      if (!L || !t.sprite || s.kind !== "npc") continue;
      const d = Math.hypot(p.x - L.fx, p.y - L.fy);
      const facePlayer = () => {
        const dx = p.x - L.fx;
        const dy = p.y - L.fy;
        const f: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
        if (f !== L.face || L.moving) {
          L.face = f;
          t.sprite!.anims.stop();
          t.sprite!.setFrame(this.frame(L.who, f));
        }
      };
      // Noticing: turn and a happy hop; the bark is handled with the head indicator below.
      if (d < 150 && !L.noticed && !paused) {
        L.noticed = true;
        facePlayer();
        if (!REDUCED) this.tweens.add({ targets: L, hop: 10, duration: 130, yoyo: true, ease: "Quad.out" });
      } else if (d > 200 && L.noticed) {
        L.noticed = false;
        L.barked = false;
      }
      if (L.noticed && d < 150 && !L.moving) facePlayer();
      // One voice at a time: the nearest speaks, the rest wait for the bubble to go and a short quiet.
      if (L.noticed && !L.barked && !paused && d < 150 && L === nearestLife && now > this.barkFreeAt) this.startBark(L, s.after?.item);
      // Patrol: hold while you're close or anything is open; otherwise walk to the next stop and wait there.
      const hold = paused || d < 170 || this.near === t;
      if (L.patrol && !REDUCED) {
        if (hold) {
          if (L.moving) {
            L.moving = false;
            t.sprite.anims.stop();
            this.tweens.add({ targets: t.sprite, angle: 0, duration: 150 });
            facePlayer();
          }
          L.waitUntil = Math.max(L.waitUntil, now + 2500);
        } else if (now > L.waitUntil) {
          const [tx, ty] = L.stops[(L.i + 1) % L.stops.length];
          const dx = tx - L.fx;
          const dy = ty - L.fy;
          const dist = Math.hypot(dx, dy);
          if (!this.stopOk(tx, ty, L)) {
            L.i = (L.i + 1) % L.stops.length; // skip a stop that's blocked or in the way
            L.waitUntil = now + 500;
          } else if (dist < 3) {
            L.i = (L.i + 1) % L.stops.length;
            L.moving = false;
            t.sprite.anims.stop();
            this.tweens.add({ targets: t.sprite, angle: 0, duration: 150 });
            t.sprite.setFrame(this.frame(L.who, L.face));
            const [a, b2] = L.patrol.pause;
            L.waitUntil = now + (a + Math.random() * (b2 - a)) * 1000;
          } else {
            const step = Math.min(dist, L.patrol.speed * dt);
            const nx = L.fx + (dx / dist) * step;
            const ny = L.fy + (dy / dist) * step;
            // Never walk toward the player once within arm's reach of them.
            const crowded = this.things.some((o) => o.life && o.life !== L && Math.hypot(o.life.fx - nx, o.life.fy - ny) < 150);
            if (Math.hypot(p.x - nx, p.y - ny) < 90 || crowded) {
              L.waitUntil = now + 2500;
              if (L.moving) {
                L.moving = false;
                t.sprite.anims.stop();
                t.sprite.setAngle(0);
                t.sprite.setFrame(this.frame(L.who, L.face));
              }
              continue;
            }
            L.fx = nx;
            L.fy = ny;
            const f: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
            if (!L.moving || f !== L.face) {
              L.face = f;
              if (!L.patrol.ice) t.sprite.anims.play(`${L.who}-${f}`, true);
            }
            L.moving = true;
            if (L.patrol.ice) {
              // Skating strides, a lean into the glide, a little spray.
              t.sprite.setFrame(this.frame(L.who, f, [0, 1, 2, 1][Math.floor(now / 330) % 4]));
              t.sprite.setAngle(Phaser.Math.Clamp((dx / dist) * 6, -8, 8) + Math.sin(now / 320) * 1.5);
              if (Math.random() < 0.15) this.puffs.explode(1, L.fx, L.fy - 2);
            }
          }
        }
      } else if (!L.noticed && now > L.nextIdle && !paused && !REDUCED) {
        // A glance to one side and back, or a little hop.
        L.nextIdle = now + 3500 + Math.random() * 5000;
        if (Math.random() < 0.6) {
          const back = L.face;
          const side: Dir = back === "left" || back === "right" ? "down" : Math.random() < 0.5 ? "left" : "right";
          t.sprite.setFrame(this.frame(L.who, side));
          this.time.delayedCall(700 + Math.random() * 500, () => {
            if (t.sprite?.active && !L.noticed && !L.moving) t.sprite.setFrame(this.frame(L.who, L.face));
          });
        } else this.tweens.add({ targets: L, hop: 6, duration: 110, yoyo: true, repeat: 1, ease: "Quad.out" });
      }
      // Follow the feet: sprite, shadow, emote, and the interaction point.
      t.sprite.setPosition(L.fx, L.fy - L.hop).setDepth(L.fy);
      L.shadow.setPosition(L.fx, L.fy - 2).setDepth(L.fy - 0.5);
      this.headIndicator(t, L, paused);
      t.x = L.fx;
      t.y = L.fy - 14;
      // Everyone keeps a personal space: the player can never walk through a townsperson, moving or not.
      t.solid = 44;
      const gap = Math.hypot(p.x - L.fx, p.y - L.fy);
      if (gap < 44) {
        // Safety net: if they ever overlap, ease them apart, moving the NPC if it has room, else the player.
        const ux = gap > 0.5 ? (L.fx - p.x) / gap : 1;
        const uy = gap > 0.5 ? (L.fy - p.y) / gap : 0;
        const push = Math.min(45 - gap, 240 * dt);
        const ground = (x: number, y: number) =>
          this.mask ? this.maskBlocked(x, y) : this.cellBlocked(Math.floor(x / CELL), Math.floor(y / CELL));
        const nx = L.fx + ux * push;
        const ny = L.fy + uy * push;
        const crowd = this.things.some((o) => o.life && o.life !== L && Math.hypot(o.life.fx - nx, o.life.fy - ny) < 60);
        if (!ground(nx, ny) && !crowd && !this.exitAt(Math.floor(nx / CELL), Math.floor((ny - 4) / CELL))) {
          L.fx = nx;
          L.fy = ny;
        } else {
          const qx = p.x - ux * push;
          const qy = p.y - uy * push;
          if (!ground(qx, qy) && !this.exitAt(Math.floor(qx / CELL), Math.floor((qy - 4) / CELL))) p.setPosition(qx, qy);
        }
        t.sprite.setPosition(L.fx, L.fy - L.hop).setDepth(L.fy);
        L.shadow.setPosition(L.fx, L.fy - 2);
        t.x = L.fx;
        t.y = L.fy - 14;
      }
    }
  }

  /** Pick a bark for this NPC's mood, never the same line twice in a row, and start typing it. */
  startBark(L: NpcLife, item?: string) {
    const set = BARKS[L.who];
    if (!set) return;
    const solved = !!item && this.bridge.claimed.has(item);
    const fresh = !solved && ![...this.talkedHere].some((k) => k.startsWith(L.who));
    const pool = solved ? set.thanks : fresh ? [...set.fresh, ...set.any.slice(0, 1)] : set.any;
    const options = pool.filter((l) => l !== L.lastBark);
    L.bark = options[Math.floor(Math.random() * options.length)] ?? pool[0];
    L.lastBark = L.bark;
    L.barkAt = this.time.now;
    L.barked = true;
    this.barkFreeAt = L.barkAt + L.bark.length / 0.03 + 2500 + 3500;
  }

  /** One indicator over a townsperson's head, redrawn only when what it shows changes. */
  headIndicator(t: Thing, L: NpcLife, paused: boolean) {
    const now = this.time.now;
    const s = t.spot;
    if (s.kind !== "npc") return;
    const inReach = this.near === t && !L.moving && !paused;
    const typed = REDUCED ? L.bark.length : Math.min(L.bark.length, Math.floor((now - L.barkAt) * 0.03));
    const barkLive = L.bark && now - L.barkAt < L.bark.length / 0.03 + 2500;
    const fresh = !(s.after && this.bridge.claimed.has(s.after.item)) && ![...this.talkedHere].some((k) => k.startsWith(L.who));
    let mode: NpcLife["mode"] = "";
    let text = "";
    if (paused) mode = "";
    else if (inReach && (!barkLive || typed >= L.bark.length)) {
      mode = "prompt";
      text = "Talk";
    } else if (barkLive) {
      mode = "bark";
      text = L.bark.slice(0, Math.max(1, typed));
      if (typed > 0 && typed < L.bark.length && typed % 3 === 0 && L.bubble?.getData("t") !== text) sfx.talk();
    } else if (fresh) mode = "bang";
    if (!barkLive && L.bark) L.bark = "";
    const key = mode + "|" + text;
    if (!L.bubble) {
      L.bubble = this.add.container(0, 0).setDepth(9550);
      t.parts.push(L.bubble);
    }
    const b = L.bubble;
    if (b.getData("key") !== key) {
      b.setData("key", key).setData("t", text);
      b.removeAll(true);
      if (mode) {
        const label = this.add.text(0, 0, mode === "bang" ? "!" : text, {
          fontFamily: "Mona Sans, system-ui, sans-serif",
          fontSize: mode === "bang" ? "22px" : "18px",
          fontStyle: "bold",
          color: mode === "bang" ? "#ffc95c" : "#fbf8f1",
        });
        label.setOrigin(0, 0.5).setResolution(2);
        const keyW = mode === "prompt" ? 30 : 0;
        const w = Math.max(mode === "bang" ? 30 : 44, label.width + keyW + 24);
        const h = 36;
        const g = this.add.graphics();
        g.fillStyle(0x141a3d, 0.95).lineStyle(2.5, 0xffc95c, 1);
        g.fillRoundedRect(-w / 2, -h, w, h, 12).strokeRoundedRect(-w / 2, -h, w, h, 12);
        g.fillTriangle(-7, -1, 7, -1, 0, 9).lineBetween(-7, 0, 0, 9).lineBetween(7, 0, 0, 9);
        g.fillStyle(0x141a3d, 1).fillRect(-6, -3, 12, 3);
        b.add(g);
        if (mode === "prompt") {
          const cap = this.add.image(-w / 2 + 12 + 12, -h / 2, "keycap").setScale(0.26);
          b.add(cap);
          label.setPosition(-w / 2 + 12 + keyW, -h / 2);
        } else label.setPosition(mode === "bang" ? -label.width / 2 : -w / 2 + 12, -h / 2);
        b.add(label);
        b.setData("w", w);
        if (!REDUCED && mode !== "bark") b.setScale(0.7);
        if (!REDUCED) this.tweens.add({ targets: b, scale: 1, duration: 160, ease: "Back.out" });
      }
    }
    // Above the head, kept inside the room (the bubble shifts; the tail stays over the head).
    const w = (b.getData("w") as number | undefined) ?? 40;
    const bx = Phaser.Math.Clamp(L.fx, w / 2 + 8, ROOM_W - w / 2 - 8);
    b.setPosition(bx, Math.max(60, L.fy - this.headHeight(t.sprite) - 12 - L.hop));
    const tail = b.list[0] as Phaser.GameObjects.Graphics | undefined;
    tail?.setX(L.fx - bx);
    // A bark fades out over its last moments.
    const left = L.barkAt + L.bark.length / 0.03 + 2500 - now;
    if (mode === "bark") b.setAlpha(Phaser.Math.Clamp(left / 450, 0, 1));
    else if (b.alpha !== 1) b.setAlpha(1);
    b.setVisible(mode !== "");
  }

  headHeights = new Map<string, number>();
  /** How far above the feet a character's drawn head reaches (frames have empty space on top; some people are short). */
  headHeight(sprite?: Phaser.GameObjects.Sprite) {
    if (!sprite || !this.heroes) return CHAR_H;
    const f = sprite.frame;
    const key = `${f.texture.key}:${f.name}`;
    let h = this.headHeights.get(key);
    if (h === undefined) {
      h = CHAR_H;
      try {
        const c = document.createElement("canvas");
        c.width = f.cutWidth;
        c.height = f.cutHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
          const px = ctx.getImageData(0, 0, f.cutWidth, f.cutHeight).data;
          let top = 0;
          scan: for (let y = 0; y < f.cutHeight; y++)
            for (let x = 0; x < f.cutWidth; x += 2)
              if (px[(y * f.cutWidth + x) * 4 + 3] > 60) {
                top = y;
                break scan;
              }
          h = (f.cutHeight * 0.97 - top) * this.baseScale();
        }
      } catch {
        // keep the full frame height
      }
      this.headHeights.set(key, h);
    }
    return h;
  }

  /** A patrol stop is fine on open ground, away from exits and terminals. */
  stopOk(x: number, y: number, L: NpcLife) {
    if (this.mask ? this.maskBlocked(x, y) : this.cellBlocked(Math.floor(x / CELL), Math.floor(y / CELL))) return false;
    for (const e of this.room.exits) for (const [c, r] of e.cells) if (Math.hypot(c * CELL + 16 - x, r * CELL + 16 - y) < 110) return false;
    for (const t of this.things) if (t.spot.kind === "terminal" && Math.hypot(t.x - x, t.y + 8 - y) < 110) return false;
    for (const t of this.things) if (t.life && t.life !== L && Math.hypot(t.life.fx - x, t.life.fy - y) < 150) return false;
    // The straight walk there must be on open ground too.
    for (let k = 1; k < 6; k++) {
      const mx = L.fx + ((x - L.fx) * k) / 6;
      const my = L.fy + ((y - L.fy) * k) / 6;
      if (this.mask ? this.maskBlocked(mx, my) : this.cellBlocked(Math.floor(mx / CELL), Math.floor(my / CELL))) return false;
    }
    return true;
  }

  icePolys = new Map<string, Phaser.Geom.Polygon[]>();
  onIce(x: number, y: number) {
    const id = this.room.id;
    let polys = this.icePolys.get(id);
    if (!polys) {
      polys = (ICE[id] ?? []).map((pts) => new Phaser.Geom.Polygon(pts.flat()));
      this.icePolys.set(id, polys);
    }
    return polys.some((poly) => poly.contains(x, y));
  }

  secretNeedsE(key: string) {
    return !!ITEMS.find((i) => i.key === key)?.question;
  }

  nearest() {
    const px = this.player.x;
    const py = this.player.y - 16;
    let best: Thing | undefined;
    let bestScore = Infinity;
    for (const t of this.things) {
      const s = t.spot;
      if (s.kind === "secret" && (this.bridge.claimed.has(s.item) || !this.secretNeedsE(s.item))) continue;
      const d = Math.hypot(t.x - px, t.y - py);
      const reach =
        s.kind === "poke" && s.size ? REACH + (Math.max(...s.size) * CELL) / 2 : s.kind === "secret" && s.look === "invisible" ? 56 : REACH;
      if (d < reach && d / reach < bestScore) {
        bestScore = d / reach;
        best = t;
      }
    }
    return best;
  }

  interact() {
    if (this.bridge.paused || this.switching || this.time.now - this.resumedAt < 250) return;
    const t = this.near;
    if (!t) return;
    const s = t.spot;
    if (s.kind === "npc") {
      const dx = this.player.x - t.x;
      const dy = this.player.y - t.y;
      const face: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
      if (this.heroes) t.sprite?.setFrame(this.frame(s.who, face));
      if (t.life) {
        t.life.face = face;
        t.life.moving = false;
        t.life.waitUntil = this.time.now + 4000;
      }
      this.talkedHere.add(s.who + s.at.join());
      this.bridge.onInteract({ kind: "npc", npc: s });
    } else if (s.kind === "poke") this.bridge.onInteract({ kind: "poke", lines: s.lines });
    else if (s.kind === "terminal") this.bridge.onInteract({ kind: "terminal", key: s.item });
    else this.bridge.onInteract({ kind: "secret", key: s.item });
  }

  go(exit: Exit) {
    const to = roomById(exit.to);
    if (!to || this.switching) return;
    this.switching = true;
    const cam = this.cameras.main;
    cam.fadeOut(180, 21, 22, 42);
    cam.once("camerafadeoutcomplete", () => {
      this.enter(to, cellCenter(exit.arrive), exit.face);
      cam.fadeIn(240, 21, 22, 42);
      this.time.delayedCall(260, () => (this.switching = false));
    });
  }

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    const b = this.bridge;
    const stopped = b.paused || this.switching;
    // The bridge's flag is the one truth: no keys reach the world while it's paused, whatever happened before.
    const kb = this.game.input.keyboard!;
    if (kb.enabled === b.paused) {
      kb.enabled = !b.paused;
      this.input.keyboard!.resetKeys();
    }
    let ix = 0;
    let iy = 0;
    if (!stopped) {
      const c = this.cursors;
      const k = this.keys;
      if (c.left.isDown || k.A.isDown) ix -= 1;
      if (c.right.isDown || k.D.isDown) ix += 1;
      if (c.up.isDown || k.W.isDown) iy -= 1;
      if (c.down.isDown || k.S.isDown) iy += 1;
    }
    const len = Math.hypot(ix, iy) || 1;
    const p = this.player;
    // On ice: momentum. Slow to start and turn, you glide on and overshoot a little, a bit faster at the top.
    const ice = this.onIce(p.x, p.y);
    const topSpeed = SPEED * (ice ? 1.3 : 1);
    const a = 1 - Math.exp(-(ice ? (ix || iy ? 2.4 : 2.2) : 16) * dt);
    this.vx += ((ix / len) * topSpeed - this.vx) * a;
    this.vy += ((iy / len) * topSpeed - this.vy) * a;
    if (Math.abs(this.vx) < 2) this.vx = 0;
    if (Math.abs(this.vy) < 2) this.vy = 0;

    // Each axis on its own, so the player slides along walls.
    const nx = p.x + this.vx * dt;
    if (!this.blocked(nx, p.y)) p.x = nx;
    else {
      // Corner forgiveness: slip round a thin post instead of snagging on it.
      const nudge = [3, -3, 5, -5].find((d) => Math.abs(this.vy) < 40 && !this.blocked(nx, p.y + d));
      if (nudge !== undefined) {
        p.x = nx;
        p.y += nudge;
      } else this.vx = 0;
    }
    const ny = p.y + this.vy * dt;
    if (!this.blocked(p.x, ny)) p.y = ny;
    else {
      const nudge = [3, -3, 5, -5].find((d) => Math.abs(this.vx) < 40 && !this.blocked(p.x + d, ny));
      if (nudge !== undefined) {
        p.y = ny;
        p.x += nudge;
      } else this.vy = 0;
    }
    p.x = Phaser.Math.Clamp(p.x, 4, ROOM_W - 4);
    p.y = Phaser.Math.Clamp(p.y, 4, ROOM_H - 2);

    if (ix && !iy) this.dir = ix < 0 ? "left" : "right";
    else if (iy && !ix) this.dir = iy < 0 ? "up" : "down";
    else if (ix && iy && (this.dir === "left" || this.dir === "right")) this.dir = ix < 0 ? "left" : "right";
    else if (ix && iy) this.dir = iy < 0 ? "up" : "down";

    const sp = Math.hypot(this.vx, this.vy);
    const walking = sp > 30 && (ix !== 0 || iy !== 0) && !ice;
    const skating = ice && sp > 30;
    const base = this.playerScale();
    if (walking) p.anims.play(this.playerAnim(this.dir), true);
    else if (skating) {
      // Skating: face where you're going, slow strides tied to speed while pushing, a glide pose while coasting.
      p.anims.stop();
      const vdir: Dir = Math.abs(this.vx) > Math.abs(this.vy) ? (this.vx < 0 ? "left" : "right") : this.vy < 0 ? "up" : "down";
      this.dir = vdir;
      const pushing = ix !== 0 || iy !== 0;
      this.skatePhase += dt * Phaser.Math.Clamp(sp / 90, 2, 4);
      p.setFrame(this.playerFrame(vdir, pushing ? [0, 1, 2, 1][Math.floor(this.skatePhase) % 4] : 1));
    } else {
      p.anims.stop();
      p.setFrame(this.playerFrame(this.dir));
    }
    // Lean into the slide (rotating round the feet), a sway, and back upright off the ice.
    const lean = skating ? Phaser.Math.Clamp((this.vx / (SPEED * 1.3)) * 7 + Math.sin(this.time.now / 320) * 2, -8, 8) : 0;
    p.setAngle(p.angle + (lean - p.angle) * (1 - Math.exp(-(skating ? 8 : 20) * dt)));
    if (skating) {
      const coast = !(ix || iy);
      p.setScale(
        base * (1 + (coast ? Math.sin(this.time.now / 250) * 0.015 : 0)),
        base * (1 + Math.abs(Math.sin(this.time.now / 260)) * 0.01),
      );
      // Thin skate lines that fade.
      this.trailDist += sp * dt;
      if (this.trailDist > 26 && !REDUCED) {
        this.trailDist = 0;
        const line = this.add
          .rectangle(p.x, p.y - 2, 22, 2, 0xffffff, 0.55)
          .setAngle((Math.atan2(this.vy, this.vx) * 180) / Math.PI)
          .setDepth(-4);
        this.ambient.push(line);
        this.tweens.add({ targets: line, alpha: 0, duration: 2600, onComplete: () => line.destroy() });
      }
    }
    if (ice && sp > 30) {
      // A skid spray when you push against your slide, and a scrape now and then.
      const along = (ix * this.vx + iy * this.vy) / (len * sp);
      if ((ix || iy) && along < 0.5 && this.time.now - this.skidAt > 60) {
        this.skidAt = this.time.now;
        this.puffs.explode(3, p.x + (Math.random() - 0.5) * 20, p.y - 2);
      }
      this.glideDist += sp * dt;
      if (this.glideDist > 170) {
        this.glideDist = 0;
        sfx.glide();
      }
    }
    // A bob while walking, a squash on stopping.
    if (walking) p.setScale(base, base * (1 + Math.abs(Math.sin(this.time.now / 85)) * 0.025));
    else if (skating) {
      // set above
    } else if (this.moving) {
      p.setScale(base * 1.05, base * 0.94);
      this.tweens.add({ targets: p, scaleX: base, scaleY: base, duration: 180, ease: "Back.out" });
    }
    this.moving = walking;
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y - 2).setDepth(p.y - 0.5);
    if (this.debug) this.drawDebug();
    for (const t of this.things) t.sprite?.setDepth(t.sprite.y);

    if (walking) {
      this.stepDist += sp * dt;
      if (this.stepDist > 46) {
        this.stepDist = 0;
        sfx.step();
        this.puffs.explode(3, p.x + (Math.random() - 0.5) * 16, p.y - 2);
      }
    }

    if (NPC_LIFE) this.liveNpcs(dt, b.paused);
    if (this.time.now - this.ambientAt > 280) {
      this.ambientAt = this.time.now;
      this.onIce(0, 0); // builds the room's ice polygons
      this.iceSparkle();
    }
    // Markers and the E prompt only while you can act.
    for (const t of this.things) t.mark?.setVisible(!b.paused);
    this.near = stopped ? undefined : this.nearest();
    if (this.near) {
      // One small prompt, above the head of whatever you'd use (in place of a terminal's marker).
      const t = this.near;
      const top = t.spot.kind === "npc" ? t.y + 14 - CHAR_H - 16 : t.spot.kind === "terminal" ? t.y - (t.base ? 100 : 76) : t.y - 44;
      // Never drawn over a townsperson's bubble: it waits for the bubble to go.
      const clash = this.things.some((o) => {
        const bub = o.life?.bubble;
        return (
          !!bub?.visible &&
          Math.abs(bub.x - t.x) < ((bub.getData("w") as number | undefined) ?? 40) / 2 + 26 &&
          Math.abs(bub.y - 18 - top) < 44
        );
      });
      this.prompt.setPosition(t.x, top).setVisible(!t.life && !clash);
      t.mark?.setVisible(false);
    } else this.prompt.setVisible(false);

    if (stopped) return;

    // Secrets found just by reaching them.
    for (const t of this.things) {
      const s = t.spot;
      if (s.kind === "secret" && !b.claimed.has(s.item) && !this.secretNeedsE(s.item) && Math.hypot(t.x - p.x, t.y - (p.y - 12)) < 48) {
        b.claimed.add(s.item); // so it fires once; the real claim comes back through refresh
        b.onInteract({ kind: "secret", key: s.item });
      }
    }

    // Exits.
    const exit = this.exitAt(Math.floor(p.x / CELL), Math.floor((p.y - 4) / CELL));
    if (exit) {
      if ((exit.needsLevel ?? 0) > b.level) {
        p.x -= this.vx * dt * 2;
        p.y -= this.vy * dt * 2;
        this.vx = this.vy = 0;
        if (this.time.now - this.blockedAt > 1500) {
          this.blockedAt = this.time.now;
          sfx.bump();
          b.onBlocked(exit.blockedLine ?? `Reach level ${exit.needsLevel} to go this way.`);
        }
      } else this.go(exit);
    }

    if (this.time.now - this.savedAt > 1500) {
      this.savedAt = this.time.now;
      this.save();
    }
  }
}

export function startGame(parent: HTMLElement, bridge: Bridge) {
  // Render at the window's real resolution (up to 2x the room), so nothing is stretched by CSS; the camera zooms by R
  // so the world stays 1536x864.
  const fit = Math.min(parent.clientWidth / ROOM_W, parent.clientHeight / ROOM_H) || 1;
  const R = Phaser.Math.Clamp(Math.ceil((window.devicePixelRatio || 1) * fit), 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: ROOM_W * R,
    height: ROOM_H * R,
    callbacks: { preBoot: (g) => g.registry.set("R", R) },
    backgroundColor: "#15162a",
    pixelArt: false,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: { target: window } },
    audio: { noAudio: true },
    banner: false,
  });
  game.scene.add("rooms", RoomScene, true, { bridge });
  if (import.meta.env.DEV)
    Object.assign(window, { __quest: { game, bridge, rooms: ROOMS, scene: () => game.scene.getScene("rooms") as RoomScene } });
  return game;
}

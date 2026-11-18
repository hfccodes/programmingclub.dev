/** Playable characters. Same layout as heroes.png: one row each, 12 frames: down 0-2, left 3-5, right 6-8, up 9-11; the middle frame of each trio is standing. */
export const PLAYERS = {
  url: "/quest/players.png",
  frameWidth: 128,
  frameHeight: 192,
  columns: 12,
  rows: [
    { id: "hero", name: "Robin" },
    { id: "maya", name: "Maya" },
    { id: "leo", name: "Leo" },
    { id: "zara", name: "Zara" },
    { id: "sam", name: "Sam" },
    { id: "kai", name: "Kai" },
  ],
} as const;

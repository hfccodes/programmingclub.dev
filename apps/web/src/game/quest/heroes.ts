/** One character per row. Each direction uses three frames with the standing pose in the middle. */
export const HEROES = {
  url: "/quest/heroes.png",
  frameWidth: 128,
  frameHeight: 192,
  columns: 12,
  rows: ["hero", "rink", "electrician", "kid", "owl", "baker", "ranger", "boarder"],
} as const;

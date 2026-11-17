// Student hackathons near campus, for the desktop's Hackathons window. Each one leaves "Coming up" the day after it ends.
//
// To refresh: look for in-person student hackathons within about two hours' drive of HFC (Dearborn) in the next one to three
// months (mlh.com/seasons, devpost.com, and the nearby schools' own sites), check every date on the organizer's own page, and
// add or edit entries below. Move one that has ended to PAST, with how members did if anyone went. Interest hearts are keyed
// by id, so never rename one that already has hearts.

export interface Hackathon {
  /** Interest hearts are stored under this id (see convex/interest.ts). */
  id: string;
  name: string;
  /** First and last day, in Detroit time. */
  start: string;
  end: string;
  /** How the dates read in the window, e.g. "Sat–Sun, Feb 6–7, 2027". */
  when: string;
  place: string;
  /** The town, for the far end of the drive line. */
  city: string;
  /** Driving time from HFC. */
  drive: string;
  host: string;
  /** The poster's color field. */
  color: string;
  url: string;
  /** Link text for `url`. */
  cta: string;
  discord?: string;
  blurb: string;
  facts: [string, string][];
  /** The next thing to do before a deadline, shown until it passes. */
  deadline?: { at: string; label: string };
}

export const HACKATHONS: Hackathon[] = [
  {
    id: "spartahack-12",
    name: "SpartaHack 12",
    start: "2027-02-06",
    end: "2027-02-07",
    when: "Sat–Sun, Feb 6–7, 2027 · 24 hours",
    place: "MSU STEM Building",
    city: "East Lansing",
    drive: "1 hr 20 min",
    host: "Michigan State University",
    color: "#7ec3eb",
    url: "https://www.spartahack.com/",
    cta: "Apply at spartahack.com",
    blurb:
      "The 12th SpartaHack, at Michigan State. Students of any major and experience level are welcome, and you can apply without a team or an idea. Lodging is inside the building.",
    facts: [
      ["Cost", "Free if accepted"],
      ["Teams", "Apply solo or with friends"],
      ["Travel", "Some support, by request"],
    ],
    deadline: { at: "2026-11-29T23:59:00-05:00", label: "Early applications close Sun, Nov 29 at 11:59 p.m." },
  },
  {
    id: "rockethacks-2027",
    name: "RocketHacks 2027",
    start: "2027-02-27",
    end: "2027-02-28",
    when: "Sat–Sun, Feb 27–28, 2027 · 24 hours",
    place: "College of Engineering",
    city: "Toledo, Ohio",
    drive: "1 hr",
    host: "University of Toledo",
    color: "#f49a1d",
    url: "https://www.rockethacks.org/",
    cta: "Visit rockethacks.org",
    discord: "https://discord.gg/nFKYdrqQ3g",
    blurb:
      "The University of Toledo’s 24-hour hackathon, for students from the Midwest and beyond. Registration hasn’t opened yet; follow their Discord for updates.",
    facts: [
      ["Registration", "Opens soon"],
      ["Cost", "Not posted yet"],
    ],
  },
];

/** Regulars whose next dates aren't out yet. */
export const NOT_ANNOUNCED: { name: string; place: string; drive: string; usually: string; url: string }[] = [
  {
    name: "WinHacks",
    place: "University of Windsor",
    drive: "About 25 min, across the border (bring a passport)",
    usually: "February",
    url: "https://winhacks.ca/",
  },
];

/** Hackathons that have ended, newest first, with how members did. */
export const PAST: {
  id: string;
  name: string;
  when: string;
  place: string;
  /** A member's finish: "1st", what in, and who. */
  result?: { rank: string; of: string; who: string };
}[] = [
  {
    id: "hack-the-nest-2026",
    name: "Hack The Nest",
    when: "Nov 14–15, 2026",
    place: "Eastern Michigan University",
    result: { rank: "1st", of: "Mind & Machine track", who: "Juan Quenga, our vice president" },
  },
  { id: "builder-wars-2026", name: "BuilderWars", when: "Nov 14–15, 2026", place: "Newlab Detroit" },
];

/** Every id that has ever taken hearts, so past counts stay readable on the officer dashboard. */
export const INTEREST_IDS = [...HACKATHONS.map((h) => h.id), ...PAST.map((p) => p.id)];

/** Hackathons that haven't ended yet (one ends at midnight after its last day, Detroit time), soonest first. */
export const upcoming = (now: number) =>
  HACKATHONS.filter((h) => new Date(`${h.end}T23:59:59-05:00`).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start));

/** "Sat–Sun, Feb 6–7, 2027 · 24 hours" → "Feb 6–7". */
export const shortWhen = (h: Hackathon) =>
  h.when
    .split(" · ")[0]
    .replace(/^[^,]*, /, "")
    .replace(/, \d{4}$/, "");

const utc = (day: string) => new Date(`${day}T12:00:00Z`);
const part = (day: string, opts: Intl.DateTimeFormatOptions) => utc(day).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** The poster's date pieces: "Sat–Sun", "February 2027", "6–7", and whole days until it starts. */
export function dateParts(h: Hackathon, now: number) {
  const sameMonth = h.start.slice(0, 7) === h.end.slice(0, 7);
  const last = sameMonth ? part(h.end, { day: "numeric" }) : part(h.end, { month: "short", day: "numeric" });
  return {
    weekdays:
      h.start === h.end
        ? part(h.start, { weekday: "short" })
        : `${part(h.start, { weekday: "short" })}–${part(h.end, { weekday: "short" })}`,
    month: part(h.start, { month: "long", year: "numeric" }),
    days: h.start === h.end ? part(h.start, { day: "numeric" }) : `${part(h.start, { day: "numeric" })}–${last}`,
    daysAway: Math.max(0, Math.ceil((new Date(`${h.start}T00:00:00-05:00`).getTime() - now) / 86_400_000)),
  };
}

// The "How it works" tab: what a first in-person college hackathon is usually like. Events differ (start day, length,
// judging, overnight rules), so every line says "usually" or "many" unless it holds for all of them. Sources: MLH's
// "What to expect at a hackathon" and packing guide, Devpost submission advice, and organizers' judging guides.

/** The usual order of an in-person hackathon. Timing varies by event, so steps carry no times. */
export const WEEKEND: { title: string; body: string }[] = [
  {
    title: "Check in",
    body: "Many events start Friday night, others Saturday morning. You check in, then an opening talk covers the rules, prizes, and schedule.",
  },
  {
    title: "Find a team",
    body: "Teams are usually capped at four. Come with friends or come alone: many events run team matching for people without one.",
  },
  {
    title: "Build",
    body: "Your project is built during the event. Most in-person hackathons feed you, and many have workshops, sponsor tables, and mentors you can ask for help.",
  },
  {
    title: "Submit",
    body: "Usually on Devpost, sometimes on the event’s own form. Expect to describe what it does and how you built it, with screenshots, a repo link, and sometimes a short video.",
  },
  {
    title: "Demo",
    body: "Often judges come to your table for a few minutes; at some events, finalists present on stage. Either way: show it working, then explain the problem and how you built it.",
  },
  {
    title: "Awards",
    body: "Winners are announced at the closing ceremony. Prizes vary: overall places, tracks, and sponsor challenges, with cash, gift cards, or gear.",
  },
];

/** What to pack, and why. From MLH's packing guide for first-time hackers. */
export const PACK: [string, string][] = [
  ["Laptop and charger", "Easy to forget the charger."],
  ["A power strip", "Outlets run short. Don’t plug strips into each other."],
  ["A jacket", "Venues are often colder than outside."],
  ["Water bottle", "Not every event has cups."],
  ["Headphones or earplugs", "To focus in a loud room, or to nap."],
  ["Toothbrush and deodorant", "Many venues have no showers."],
];

/** Advice from organizers, mentors, and judges. */
export const TIPS: { title: string; body: string }[] = [
  {
    title: "Read the event page first",
    body: "Start time, team size, what’s provided, and whether you can stay overnight all differ from event to event.",
  },
  {
    title: "Install your tools at home",
    body: "Event Wi-Fi is often overloaded. Set up your editor, Git, and anything you plan to use before you go.",
  },
  {
    title: "Build something small that works",
    body: "Pick one feature you can show from start to finish. Add more only once that works.",
  },
  {
    title: "Ask for help early",
    body: "If the event has mentors, helping you get unstuck is what they’re there for.",
  },
  {
    title: "Write the submission early",
    body: "Draft it halfway through, not in the last hour. Keep the template’s headings, and answer each judging criterion directly.",
  },
  {
    title: "Read the tracks and sponsor prizes",
    body: "Many events award prizes beyond the overall places. Check them at the start, and if you go for one, say which tools you used and why.",
  },
  {
    title: "Practice the demo",
    body: "Run it start to finish before judging, so it doesn’t break in front of the judges. Lead with the problem in one sentence.",
  },
];

// The Learn to Code app's reading list (components/desktop/apps.tsx), in the order a beginner would meet them.
// Keep prices honest and general: they change, so say "free tier" or "paid" rather than a number.

export type Price = "Free" | "Free tier" | "Paid" | "Free for students";

export interface Resource {
  name: string;
  url: string;
  /** One line: what it is and who it's for. */
  blurb: string;
  price: Price;
  /** Extra words the desktop search should match. */
  tags?: string;
  /** A top pick, shown first in its stage. */
  pick?: boolean;
}

export interface Stage {
  id: "start" | "build" | "practice" | "hired";
  title: string;
  /** What this stage is for, in a sentence. */
  goal: string;
  items: Resource[];
}

export const STAGES: Stage[] = [
  {
    id: "start",
    title: "Start",
    goal: "Pick one course and finish it. Any of these gets you from zero to writing real programs.",
    items: [
      {
        name: "CS50x",
        url: "https://cs50.harvard.edu/x/",
        blurb: "Harvard’s intro to computer science: C, Python, SQL, and the web, with a free certificate.",
        price: "Free",
        tags: "harvard computer science c python beginner",
        pick: true,
      },
      {
        name: "freeCodeCamp",
        url: "https://www.freecodecamp.org/",
        blurb: "Hands-on lessons and certifications in web development, JavaScript, and Python.",
        price: "Free",
        tags: "web javascript html css python certification beginner",
        pick: true,
      },
      {
        name: "The Odin Project",
        url: "https://www.theodinproject.com/",
        blurb: "A full-stack web curriculum built around projects, with a big, helpful Discord.",
        price: "Free",
        tags: "web full stack javascript ruby rails projects",
      },
      {
        name: "Codecademy",
        url: "https://www.codecademy.com/",
        blurb: "Short interactive lessons in the browser. Good for a first taste of a language.",
        price: "Free tier",
        tags: "interactive beginner python javascript",
      },
    ],
  },
  {
    id: "build",
    title: "Go deeper",
    goal: "Learn a stack well enough to build something you’d show someone.",
    items: [
      {
        name: "Boot.dev",
        url: "https://www.boot.dev/",
        blurb: "A gamified backend path in Python, Go, and SQL. Read the lessons free; a membership unlocks the interactive parts.",
        price: "Free tier",
        tags: "backend python go golang sql gamified",
        pick: true,
      },
      {
        name: "Full Stack Open",
        url: "https://fullstackopen.com/",
        blurb: "University of Helsinki’s course on React, Node, TypeScript, and testing.",
        price: "Free",
        tags: "react node typescript web university",
      },
      {
        name: "Udemy",
        url: "https://www.udemy.com/",
        blurb: "Video courses on almost anything, often on sale. Check the reviews and the last-updated date before buying.",
        price: "Paid",
        tags: "video courses sale",
      },
      {
        name: "roadmap.sh",
        url: "https://roadmap.sh/",
        blurb: "Step-by-step maps of what to learn for frontend, backend, DevOps, and more.",
        price: "Free",
        tags: "roadmap career path frontend backend devops",
      },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    goal: "Solve problems and build from designs until it feels normal.",
    items: [
      {
        name: "Advent of Code",
        url: "https://adventofcode.com/",
        blurb: "A puzzle a day, December 1 to 25, in any language. Some members do it together.",
        price: "Free",
        tags: "puzzles december challenge any language",
        pick: true,
      },
      {
        name: "Exercism",
        url: "https://exercism.org/",
        blurb: "Exercises in 70+ languages, with free feedback from volunteer mentors.",
        price: "Free",
        tags: "exercises mentors languages",
      },
      {
        name: "NeetCode",
        url: "https://neetcode.io/",
        blurb: "A roadmap of the interview problems that matter, each with a video walkthrough.",
        price: "Free tier",
        tags: "interview leetcode algorithms data structures",
      },
      {
        name: "LeetCode",
        url: "https://leetcode.com/",
        blurb: "The problem bank most companies draw coding interviews from.",
        price: "Free tier",
        tags: "interview algorithms data structures",
      },
      {
        name: "Frontend Mentor",
        url: "https://www.frontendmentor.io/",
        blurb: "Real designs to build as HTML, CSS, and JavaScript, so your portfolio looks like work.",
        price: "Free tier",
        tags: "frontend css design portfolio",
      },
    ],
  },
  {
    id: "hired",
    title: "Get hired",
    goal: "Turn what you know into interviews: a portfolio, a resume, and applications.",
    items: [
      {
        name: "GitHub Student Developer Pack",
        url: "https://education.github.com/pack",
        blurb: "Copilot, a free domain, cloud credits, and more, with your student email.",
        price: "Free for students",
        tags: "github copilot domain cloud credits student",
        pick: true,
      },
      {
        name: "Tech Interview Handbook",
        url: "https://www.techinterviewhandbook.org/",
        blurb: "How to write the resume, practice, and get through coding and behavioral interviews.",
        price: "Free",
        tags: "resume interview behavioral guide",
      },
      {
        name: "Simplify internship lists",
        url: "https://github.com/SimplifyJobs",
        blurb: "Community-kept lists of open internships and new-grad roles, updated daily on GitHub.",
        price: "Free",
        tags: "internships jobs new grad apply",
      },
      {
        name: "Major League Hacking",
        url: "https://mlh.io/",
        blurb: "The season’s student hackathons. A weekend project and a team look great on a resume.",
        price: "Free",
        tags: "hackathons mlh events",
      },
    ],
  },
];

export const RESOURCES = STAGES.flatMap((s) => s.items.map((r) => ({ ...r, stage: s.title })));

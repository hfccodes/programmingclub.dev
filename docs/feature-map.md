# Feature Map

Concise map of routes, desktop windows, accessible selectors, and test entrypoints for `apps/web` so agents can navigate and verify UI flows deterministically instead of guessing DOM structure.

## Verification loops

| Check | Command | Notes |
| --- | --- | --- |
| Full inner loop (same as CI) | `bun run verify` | Runs `typecheck`, `lint`, `check` (Prettier), `test` (`src/` + `convex/` unit tests), and `build`. |
| Unit + Convex tests only | `bun run test` | `bun test src/ convex/` inside `apps/web` (uses `convex-test` and Python for puzzle verification). |
| Playwright E2E | `cd apps/web && BASE_UI_TEST_URL=http://localhost:3000 bun run test:ui` | Reuses an already-running dev server; never starts or stops the owner's dev server. |
| Single E2E spec | `cd apps/web && bunx playwright test e2e/desktop.spec.ts` | Supports `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `PLAYWRIGHT_OUTPUT_DIR`. |

## Desktop shell (`_desktop` routes)

Implemented in `apps/web/src/components/desktop/desktop.tsx`, `apps.tsx`, and `launcher.tsx`.

- **Desktop layout (`>= md`):** Every open window is `<section role="dialog" aria-label={app.title} data-win={app.id}>` (title bar is its `<header>`). Docked windows set `data-snap="left" | "right"`, and drag previews render `.snap-hint`.
- **Window title-bar buttons:** `Minimize <title>`, `Maximize <title>` / `Restore <title>`, `Close <title>`.
- **Fresh load on `/`:** Opens `welcome.txt` and `Meetings` tiled side by side (`Meetings` minimizes on narrow viewports `<= 56rem`).
- **Phone layout (`< md`):** Renders a home screen of icons on `/` and opens the active route full screen with a taskbar `Home` link (`aria-label="Back to the home screen"`).
- **Taskbar & Start menu:**
  - Start trigger: `button[aria-label="Start"]` -> popup `menu[aria-label="Start"]` with `menuitem` entries per public app plus `Instagram` and `Officer sign-in`.
  - Taskbar buttons carry `data-task={app.id}`.
  - Search launcher: `button[aria-label="Search"]` or `Ctrl+K` / `⌘K` / `/` -> `dialog[aria-label="Search the desktop"]` containing `combobox[aria-label="Search apps and places to learn"]` and `option` rows.
- **Reduced motion:** Emulate `reducedMotion: "reduce"` in Playwright for deterministic window open/close/minimize timing (no animation delay or fly-to-taskbar phase).

| App `id` | Route | Window `role="dialog"` name (`title`) | Icon / Menu `label` | Access |
| --- | --- | --- | --- | --- |
| `about` | `/about` | `welcome.txt` | `Welcome` | Public |
| `meetings` | `/meetings` | `Meetings` | `Meetings` | Public |
| `world-cup` | `/world-cup` | `Hello, World Cup` | `Hello, World Cup` | Public |
| `learn` | `/learn-to-code` | `Learn to code` | `Learn to Code` | Public |
| `hackathons` | `/hackathons` | `Hackathons` | `Hackathons` | Public |
| `officers` | `/officers` | `Officers` | `Officers` | Public |
| `join` | `/how-to-join` | `How to join` | `How to join` | Public |
| `discord` | `/club-discord` | `Discord` | `Discord` | Public |
| `contribute` | `/contribute` | `CONTRIBUTING.md` | `Contribute` | Public |
| `site` | `/site` | `About this site` | `About this site` | Public (footer card, not icon grid) |
| `dashboard` | `/dashboard` | `Officer dashboard` | `Dashboard` | Officer (`OFFICER_EMAILS`) |

### Key inner-window selectors

- **Learn to Code (`/learn-to-code`):** Four tabs in `tablist[aria-label="Where you are"]` (`Start`, `Go deeper`, `Build`, `Get hired`). `Get hired` links to `/hackathons` (`See hackathons near campus`).
- **Hackathons (`/hackathons`):** Folder tabs in `tablist[aria-label="Hackathons near campus"]` — one tab per upcoming event from `apps/web/src/lib/hackathons.ts`, plus `How it works`. Soonest event opens first, so pick a specific event tab by name in tests.

## Hello, World Cup (`/hello-world/*`)

Layout in `apps/web/src/routes/hello-world/route.tsx`. Full-screen (`bare`) routes omit the shared nav and footer: `/hello-world/tv`, `/hello-world/kickoff`, `/hello-world/join`, `/hello-world/draw`, and `/hello-world/quest`.

| Route | Purpose | Access |
| --- | --- | --- |
| `/hello-world` | Cup landing page and next-meeting countdown | Public |
| `/hello-world/season` | Full season calendar and weekly games | Public |
| `/hello-world/rules` | Rules for the six Cup games | Public |
| `/hello-world/cup` | Cup night agenda and Final format | Public |
| `/hello-world/scores` | Live Season XP leaderboard (`api.stats.leaderboard`) | Public |
| `/hello-world/join` (alias `/join`) | Player phone/laptop join flow and live round participation | Public (join code from TV) |
| `/hello-world/wiki` (alias `/wiki`) | Lab computer waiting screen for Wiki Race | Public |
| `/hello-world/fix` | Lab computer workspace for Fix it for real and puzzles | Public (team key) |
| `/hello-world/quest` | Snow Quest painted-room Phaser adventure | Public |
| `/hello-world/quest-dev` | Snow Quest dev bench (`import.meta.env.DEV` only) | Dev only |
| `/hello-world/tv` | Room TV display (slides, cards, timers, scores, QR join) | Public / room display |
| `/hello-world/host` | Officer host console (runs nights, teams, rounds, scoring) | Officer |
| `/hello-world/draw` | Shared officer tablet drawing pad for Tech Pictionary | Officer |
| `/hello-world/schedule` | Officer season planner | Officer |
| `/hello-world/kickoff` | Kickoff slide deck | Officer / presentation |
| `/hello-world/kit` | Officer game plan / kit | Officer |
| `/hello-world/test` | Officer round/card preview harness | Officer |
| `/hello-world/sounds` | Sound effect test page | Unlisted |

## Club flows & standalone pages

| Route | Purpose | Access |
| --- | --- | --- |
| `/discord` (alias `/discord/verify`) | HawkMail -> Discord role verification (`?done=`, `?error=`) | HFC HawkMail / Officer |
| `/survey` | Member planning survey | Public |
| `/survey/results` | Survey breakdown and responses | Officer |
| `/sign-in/$` | Clerk sign-in with validated `?redirect=` | Public |
| `/privacy`, `/terms` | Club legal pages | Public |

## Playwright E2E suites (`apps/web/e2e/`)

| Spec | What it verifies | Requires live Convex? |
| --- | --- | --- |
| `desktop.spec.ts` | Learn to Code tabs, Hackathons tabs, `Ctrl+K` search, window drag/dock/maximize/resize, holiday lights motion | Only for live schedule/interest hydration (core flows work with dev server) |
| `start-menu.spec.ts` | Start menu keyboard navigation (`ArrowDown`, `Home`, `End`, typeahead, `Escape`) and phone landscape bounds | No |
| `migration.spec.ts` | Static check against blocking browser dialogs on Cup routes + smoke test of public `/hello-world/*` routes | No |
| `base-ui.spec.ts` | Confirmation dialog queue, focus return, and error banners via `/e2e/fixtures/cup-controls.jsx` | No (WebSockets blocked) |
| `drawing.spec.ts` | Tech Pictionary canvas strokes, undo/clear/skip via `/e2e/fixtures/drawing.jsx` + mocked Convex store | No (intercepted) |
| `host-controls.spec.ts` | Host console controls via `/e2e/fixtures/host-controls.jsx` + mocked Convex store | No (intercepted) |
| `host-layout.spec.ts` | Host console viewport/layout invariants via `/e2e/fixtures/host-layout.jsx` + mocked Convex store | No (intercepted) |
| `rounds.spec.ts` | Round flows (Fix it for real, puzzles, phone layouts) via `/e2e/fixtures/rounds.jsx` | No (intercepted) |

## Architectural boundaries (enforced by ESLint)

- **No circular imports:** `import/no-cycle` is an error across `src/` and `convex/`.
- **Shared pure layer:** `apps/web/src/lib/*` holds pure logic and data shared by both client code and Convex functions.
- **Convex server boundary:** `convex/**` cannot import React, TanStack, Clerk, Base UI, Phaser, Three, `#/*`, or `src/{components,routes,game}/*`.
- **Client -> Convex boundary:** `src/**` may only import Convex generated modules (`convex/_generated/{api,dataModel}`), never Convex handler source files directly.
- **No blocking browser dialogs in Cup routes:** `no-alert` is enforced in `src/routes/hello-world/**`; use the Base UI feedback/confirm primitives in `src/components/feedback.tsx`.

# Agent notes

## Service access: use CLIs before computer use

On the owner's machine (Juan's), these CLIs are installed and authenticated. Use them for any dashboard-style task (env vars, deploys, logs, settings, users, projects) before reaching for computer use or asking the owner to click through a web console. Fall back to computer use only when the CLI genuinely can't do it, and say why.

| Service | CLI | This repo's target |
| --- | --- | --- |
| Vercel | `vercel` | project `programming-club` (`prj_C7Qrg1YWPB1iPcCYgcVsqbbCpRqa`), root `apps/web` |
| Clerk | `bunx clerk@latest` | app "The Programming Club" (`app_3KTHTX6SIIwCIoHtAOBSdH6lPYq`), linked by git remote |
| Google Cloud | `gcloud` | project `programming-club-auth` (default) |

- Vercel: `vercel env ls|add|pull`, `vercel logs`, `vercel ls`, `vercel project inspect programming-club`. Pass `--scope`/project flags or run from `apps/web` after `vercel link`.
- Clerk: run from `apps/web`. `clerk whoami`, `clerk users`, `clerk config`, `clerk env`, and `clerk api <endpoint>` for anything else (`clerk api ls` to browse). Instances: dev `ins_3KTHTTjAoUNtM0lObFIIYveQZk7`, prod `ins_3KTHjlCwYOKukIoxJ6nZCjposW5` (`clerk.programmingclub.dev`). The CLI's link can miss prod (`whoami` shows `production: null`); pass `--instance <id>` instead.
- Google Cloud: `gcloud services`, `gcloud iam`, `gcloud projects`, etc. Application Default Credentials are set too. A few things (e.g. the OAuth consent screen) are console-only.
- Check auth first (`vercel whoami`, `clerk whoami`, `gcloud auth list`). If a CLI is missing or signed out, tell the owner rather than switching to computer use silently. Other contributors won't have this access.
- Officer access comes from `OFFICER_EMAILS` on each Convex deployment (`bunx convex env get|set OFFICER_EMAILS --deployment <name>`). Never put real emails or other personal data in the repo: it's public.
- Clerk's agent skills (`clerk/skills`, unlicensed) aren't committed. Restore them locally from `skills-lock.json` with `bunx skills add clerk/skills`.
- Confirm before anything destructive or production-facing: deleting resources, rotating keys, production env changes, production deploys.

## Screenshots in PR descriptions

Put them on the `pr-assets` branch, never on a branch of their own: it's an orphan branch (no shared history with `main`) with a folder per PR (`pr-12/`), and a ruleset blocks deleting or force-pushing it. Add a commit with a `pr-<n>/` folder on top of the branch tip (`git hash-object`/`mktree`/`commit-tree` works without touching the checkout), push it, and link images by that commit's SHA so later pushes never change an old PR: `https://raw.githubusercontent.com/hfccodes/programmingclub.dev/<sha>/pr-<n>/<file>.png`.

## Refreshing the Hackathons window

The desktop's Hackathons window (`/hackathons`) reads everything from `apps/web/src/lib/hackathons.ts`; there's nothing to change anywhere else, and Convex accepts interest hearts for every id listed there.

- Scope: in-person student hackathons within about a two-hour drive of HFC (Dearborn) that start in the next one to three months. Windsor counts, but say it needs a passport.
- Sources: the MLH season page (`mlh.com/seasons/<year>/events`), Devpost, and the nearby schools' own sites (SpartaHack/MSU, RocketHacks/Toledo, WinHacks/Windsor, GrizzHacks/Oakland, MHacks/UMich, Hack The Nest/EMU, BuilderWars/Wayne State). Confirm every date on the organizer's own page; aggregators are often stale.
- Each event drops out of "Coming up" on its own the day after it ends. Move ended ones to `PAST` (with how members did, if anyone went), move a `NOT_ANNOUNCED` regular into `HACKATHONS` once its dates are out, and never rename an id that already has hearts.
- Convex imports the list, so a change ships with the next deploy (Vercel runs `convex deploy`). Run `bun run typecheck` and the desktop e2e test after editing.

<div align="center">

<img src="apps/web/public/logo.png" width="88" alt="The Programming Club logo" />

# The Programming Club

**The website, game nights, and club tools for The Programming Club at Henry Ford College.**

[![Website](https://img.shields.io/badge/programmingclub.dev-0b4fa3?style=flat-square&logo=googlechrome&logoColor=white)](https://programmingclub.dev) [![Discord](https://img.shields.io/badge/join%20the%20Discord-0f1f3d?style=flat-square&logo=discord&logoColor=white)](https://programmingclub.dev/discord) [![License: MIT](https://img.shields.io/badge/license-MIT-efc12c?style=flat-square)](LICENSE) [![Contributions welcome](https://img.shields.io/badge/contributions-welcome-7ec3eb?style=flat-square)](CONTRIBUTING.md)

[Website](https://programmingclub.dev) · [Hello, World Cup](https://programmingclub.dev/hello-world) · [Join the Discord](https://programmingclub.dev/discord) · [Contributing](CONTRIBUTING.md)

<br />

<img src=".github/assets/home.jpg" alt="programmingclub.dev: the club's home page, a desktop with windows for the welcome note and this season's meetings" width="100%" />

</div>

## What's inside

- **A desktop for a home page.** [programmingclub.dev](https://programmingclub.dev) is a little operating system: open windows for meetings, officers, hackathons nearby, learning to code, and how to join. The wallpaper changes with the season.
- **Hello, World Cup.** The club's weekly coding game nights: six games, a TV that runs the room, a join page on every phone, an officer console to host it, and season XP on a public leaderboard.
- **A verified Discord.** Members sign in with their HawkMail and connect Discord at [/discord](https://programmingclub.dev/discord), and the club's bot adds them to the server with the roles they picked.
- **A member survey.** What members want, how they code, and when they're free, with cross-filtering charts so officers can plan around it.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src=".github/assets/hello-world.jpg" alt="Hello, World Cup landing page" /></td>
    <td width="50%"><img src=".github/assets/rules.jpg" alt="The six Hello, World Cup games" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Hello, World Cup</b>: eight Wednesdays of coding games</sub></td>
    <td align="center"><sub><b>Six games</b>, each explained in under a minute</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/kickoff.jpg" alt="Kickoff slide on the TV with a warm-up puzzle and a join QR code" /></td>
    <td width="50%"><img src=".github/assets/discord.jpg" alt="The Discord join page: sign in with HawkMail, pick pings, connect Discord" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>On the TV</b>: scan to join, warm up while people arrive</sub></td>
    <td align="center"><sub><b>Join the Discord</b>: HawkMail-verified, roles by interest</sub></td>
  </tr>
</table>

<p align="center">
  <img src=".github/assets/phone-home.jpg" alt="The home page on a phone" width="240" />
  &nbsp;&nbsp;&nbsp;
  <img src=".github/assets/phone-discord.jpg" alt="The Discord join page on a phone" width="240" />
</p>

## Built with

| Layer | What we use |
| --- | --- |
| **App** | [TanStack Start](https://tanstack.com/start) and React, styled with [Tailwind CSS](https://tailwindcss.com) |
| **Backend** | [Convex](https://convex.dev): the database, live game state, and the Discord bot's OAuth callback |
| **Sign-in** | [Clerk](https://clerk.com), with HawkMail for members |
| **Tooling** | [Bun](https://bun.sh) workspaces, TypeScript, ESLint, Prettier, Playwright |
| **Hosting** | [Vercel](https://vercel.com), which deploys Convex on every push to `main` |

## Repo layout

A Bun workspace with one app today, room for more.

| Path | What it is |
| --- | --- |
| [`apps/web`](apps/web) | **programmingclub.dev**: the club's home page, Hello, World Cup at `/hello-world`, the Discord join page, and the member survey |

New projects (another event, a club tool) go in `apps/<name>` with their own `package.json`. Shared code can move into `packages/<name>` later and be added to `workspaces` in the root `package.json`.

## Running it locally

```bash
bun install          # once, from the repo root
bun run dev          # runs apps/web
bun run typecheck    # every workspace
bun run lint
```

You'll need your own free Convex and Clerk dev setups. [CONTRIBUTING.md](CONTRIBUTING.md) walks through it, and no access to the club's accounts is needed.

## Open questions

- **Code Relay without a computer per team** ([#11](https://github.com/hfccodes/programmingclub.dev/issues/11)). Every other game now plays on the join screen, on a phone or a laptop. Code Relay still needs a keyboard per team, and we haven't decided what it looks like in a room without computers.

## Contributing

Contributions are welcome from club members and anyone else. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md), and security problems go through [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The license covers the code, not Henry Ford College's name or logos.

<br />

<p align="center"><sub>Made by students at Henry Ford College. Not an official Henry Ford College site.</sub></p>

import { createFileRoute } from "@tanstack/react-router";
import { AgendaList, HourDial, Picto, Wrap } from "#/components/ui";
import { CUP_AGENDA, FINAL_AGENDA } from "#/lib/content";
import { ITEMS, LEVELS, WAIT_MS } from "#/lib/quest";
import { useSchedule } from "#/lib/schedule";
import { CLUB, fmtDate } from "#/lib/season";
import type { Agenda } from "#/lib/types";

export const Route = createFileRoute("/hello-world/cup")({
  head: () => ({ meta: [{ title: `Cup nights · ${CLUB.season}` }] }),
  component: Cup,
});

const noSetup = (rows: Agenda[]) => rows.filter((r) => r.what !== "Officers set up");
const puzzles = ITEMS.filter((i) => i.kind === "puzzle");
const levels = LEVELS.filter((l) => l.points > 0);

function Cup() {
  const plan = useSchedule();
  const d = (i: number) => fmtDate(plan[i].start, { month: "long", day: "numeric" });
  return (
    <>
      <Wrap className="grid gap-[3px] pt-14 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col justify-end bg-mist p-8 md:p-12">
          <h1 className="text-[clamp(3rem,7vw,6rem)] leading-[0.9]">cup nights</h1>
          <p className="mt-6 max-w-[42ch] text-xl leading-relaxed">
            The Midseason Cup on {d(3)} and the Final on {d(5)}. Everyone starts at zero, so a first-timer can win.
          </p>
        </div>
        <figure className="tile tile-gold aspect-square">
          <Picto id="keycap" className="absolute inset-[16%]" label="The Golden Keycap" />
          <figcaption className="absolute right-5 bottom-4 left-5 text-sm font-semibold">
            The Golden Keycap. Midseason champions sign the side; Season 0 champions sign the top.
          </figcaption>
        </figure>
      </Wrap>

      <Night
        title="the midseason cup"
        intro="Four rounds: Output?, Wiki Race, Code Relay, and Fix it for real. Like every game night, the last round counts double."
        rows={noSetup(CUP_AGENDA)}
      />
      <Night
        title="the final"
        intro="One game, all night: Snow Quest, played solo on a laptop or lab computer. Points come in all game long, so the scoreboard moves the whole time. The Midseason champions defend the Keycap."
        rows={noSetup(FINAL_AGENDA)}
      />

      <Wrap className="mt-28">
        <div className="theme-night grid gap-12 rounded-[6px] px-8 py-14 md:grid-cols-[1fr_1.2fr] md:px-14">
          <div>
            <h2 className="text-[clamp(2.2rem,4vw,3.4rem)] lowercase">snow quest</h2>
            <p className="mt-5 max-w-[38ch] text-lg text-dim">
              Pine Street is getting ready for winter, and the town’s terminals need help. Walk around town, solve small coding puzzles,
              level up, and find the secrets hidden along the way.
            </p>
            {/* A plain link: the game's route is its own bundle. */}
            <a href="/hello-world/quest" className="btn mt-6 inline-block">
              Try it now (practice)
            </a>
          </div>
          <div>
            <ol className="steps text-xl">
              <li>
                Join on your phone like every night, then tap Play Snow Quest. Play on a laptop or a lab computer; on a lab computer, join
                there too with the same HawkMail.
              </li>
              <li>
                Walk up to a terminal to open a puzzle. Each one has a short story, a worked example, and a hint. Solve it in any language,
                or by hand, and type in your answer.
              </li>
              <li>
                Every puzzle you solve scores right away ({puzzles.map((p) => p.points).join(", ")} points, easiest to hardest). The last
                one, at the festival, is worth the most.
              </li>
              <li>
                Solving earns XP. Level-ups add {levels.map((l) => l.points).join(", ")} points, and each opens the next part of town. Two
                puzzles, or one puzzle and a secret, always get you there.
              </li>
              <li>Secrets are hidden around town: some you just find, some you have to crack. They score too.</li>
              <li>A wrong answer makes that terminal wait {WAIT_MS / 1000} seconds. Everyone plays solo, for about 40 minutes.</li>
            </ol>
            <p className="mt-6 text-dim">Tiebreaker: the higher quest level, then one sudden-death question.</p>
          </div>
        </div>
      </Wrap>
    </>
  );
}

function Night({ title, intro, rows }: { title: string; intro: string; rows: Agenda[] }) {
  return (
    <Wrap className="mt-24 grid items-start gap-x-20 gap-y-10 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <div className="lg:sticky lg:top-24">
        <HourDial rows={rows} className="mx-auto w-full max-w-[24rem]" />
        <p className="mt-4 text-center text-sm text-dim">Officers arrive at 4:45 to set up.</p>
      </div>
      <div>
        <h2 className="text-[clamp(2.4rem,5vw,4rem)] lowercase">{title}</h2>
        <p className="mt-3 max-w-[54ch] text-lg text-dim">{intro}</p>
        <div className="mt-8">
          <AgendaList rows={rows} />
        </div>
      </div>
    </Wrap>
  );
}

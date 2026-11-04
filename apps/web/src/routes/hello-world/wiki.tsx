import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { Picto, Wrap } from "#/components/ui";
import { wikiUrl } from "#/lib/content";
import { CLUB } from "#/lib/season";

// A computer racing a Wiki Race opens this before the race (programmingclub.dev/wiki) and waits. When the race starts
// it goes to the start article on Wikipedia, and from then on it's Wikipedia's page, not ours: it can't follow the
// night anymore, so it's opened again before each race. Phones need none of this: the join page has the race.
export const Route = createFileRoute("/hello-world/wiki")({
  head: () => ({ meta: [{ title: `Wiki Race · ${CLUB.season}` }] }),
  component: Wiki,
});

function Wiki() {
  const live = useQuery(api.sessions.live);
  const s = live?.screen;
  const from = s?.mode === "wiki" && !s.revealed && !s.wikiReady ? s.wikiFrom : undefined;
  const ready = s?.mode === "wiki" && !!s.wikiReady;
  // replace, not assign, so Back on the start article doesn't land here and bounce forward again.
  useEffect(() => {
    if (from) window.location.replace(wikiUrl(from));
  }, [from]);

  return (
    <Wrap className="max-w-xl py-16">
      <div className="tile tile-sky size-24">
        <Picto id="wiki" className="absolute inset-[14%]" />
      </div>
      <h1 className="mt-6 text-[clamp(2.4rem,6vw,4rem)] lowercase">wiki race</h1>
      {from ? (
        <p className="mt-4 text-lg">
          Opening{" "}
          <a href={wikiUrl(from)} className="link">
            {from}
          </a>
          …
        </p>
      ) : (
        <p className="mt-4 text-lg text-dim">
          {live === undefined
            ? "Checking for a race…"
            : ready
              ? "You’re ready. Keep this page open: it opens the start article on Wikipedia when the race starts."
              : "Keep this page open. It opens the start article on Wikipedia when the next race starts."}
        </p>
      )}
      <p className="mt-6 text-sm text-dim">
        When the race starts, this tab goes to Wikipedia and stops following the night. Before the next race, open {CLUB.url}/wiki here
        again.
      </p>
    </Wrap>
  );
}

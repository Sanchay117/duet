"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon, Logo, Poster } from "@/components/ui";
import { domainOf } from "@/lib/domain";
import { useLearned, useMap, usePerson, useSessions } from "@/lib/store";
import type { Entity, Reaction } from "@/lib/types";

export default function CareCard() {
  const { id } = useParams<{ id: string }>();
  const person = usePerson(id);
  const map = useMap(id);
  const learned = useLearned(id);
  const sessions = useSessions(id);

  if (person === undefined || map === undefined || !learned || !sessions) return null;
  if (!person || !map)
    return (
      <main className="grid flex-1 place-items-center p-10 text-center">
        <Link href="/" className="underline">
          Nothing here yet. Go home.
        </Link>
      </main>
    );

  const pos = person.pronoun === "he" ? "his" : person.pronoun === "they" ? "their" : "her";
  const obj = person.pronoun === "he" ? "him" : person.pronoun === "they" ? "them" : "her";
  const sub = person.pronoun ?? "she";
  const all: Reaction[] = sessions.flatMap((s) => s.reactions).sort((a, b) => a.at - b.at);
  // Only the most recent reaction to each item counts; people change from week to week.
  const latest = [...new Map(all.map((r) => [r.entityId, r])).values()];
  const upsetIds = new Set(latest.filter((r) => r.kind === "distress").map((r) => r.entityId));
  const sparks: Entity[] = (learned.sparks.length ? learned.sparks : [...map.seeds, ...map.guessed]).filter((e) => !upsetIds.has(e.id)).slice(0, 6);
  const firstMusic = sparks.find((s) => s.kind === "artist");
  const calm = [...new Set(latest.filter((r) => r.kind === "calm" && r.entityName !== firstMusic?.name).map((r) => r.entityName))].slice(0, 6);
  const avoid = [...new Set(latest.filter((r) => r.kind === "distress").map((r) => r.entityName))];
  const themes = [...new Set(learned.avoidTags.map((t) => t.name))]
    .filter((t, i, list) => list.findIndex((x) => x.slice(0, 4).toLowerCase() === t.slice(0, 4).toLowerCase()) === i)
    .slice(0, 4);
  const starters = [...new Set(all.filter((r) => r.kind === "joy" && r.prompt && !upsetIds.has(r.entityId)).map((r) => r.prompt!))].slice(0, 5);
  const fallbackStarters = map.session
    .filter((c) => !upsetIds.has(c.entity.id) && !learned.avoidIds.includes(c.entity.id))
    .slice(0, 4)
    .map((c) => c.prompt);
  const words = learned.notes.slice(-6);
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <main className="flex-1 bg-paper print:bg-white">
      <div className="no-print mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <Link href={`/p/${id}`} className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <Icon name="arrow-left" size={16} /> Memory map
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm text-paper hover:bg-clay-2">
          <Icon name="print" size={16} /> Print or save as PDF
        </button>
      </div>

      <article className="mx-auto mb-16 w-[calc(100%-2rem)] max-w-4xl rounded-3xl border border-line bg-card p-6 shadow-[0_30px_80px_-50px_rgba(34,28,21,.6)] print:m-0 print:w-full print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-clay-2">Care card · what brings {obj} back</p>
            <h1 className="serif mt-2 text-5xl">{person.name}</h1>
            <p className="mt-2 text-ink-2">
              Born {person.birthYear}, grew up in {map.place ?? person.hometown}. Memory years {map.window.from}–{map.window.to}.
              {map.language ? ` Heart language: ${map.language}.` : ""}
            </p>
          </div>
          <Logo size={18} />
        </header>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <section>
            <h2 className="serif text-2xl">Lights {obj} up</h2>
            <p className="text-sm text-ink-3">{learned.sparks.length ? "Seen in sessions" : "Known favourites, before any sessions"}</p>
            <ul className="mt-4 space-y-3">
              {sparks.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <Poster entity={e} domain={domainOf(e)} className="h-12 w-10" rounded="rounded-md" />
                  <span>
                    <span className="serif block text-lg leading-tight">{e.name}</span>
                    <span className="text-xs text-ink-3">{e.year ?? (e.careerFrom ? `from ${e.careerFrom}` : "")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="serif text-2xl">When {sub === "they" ? "they are" : `${sub} is`} upset</h2>
            <p className="mt-3 leading-relaxed text-ink-2">
              {firstMusic ? (
                <>
                  Play <strong className="font-semibold text-ink">{firstMusic.name}</strong> softly. Sit close, slow your own
                  breathing, no questions.
                </>
              ) : (
                "Play something familiar from the lists here, softly. Sit close, no questions."
              )}
            </p>
            {calm.length > 0 && <p className="mt-2 text-sm text-ink-2">Also calming: {calm.join(", ")}.</p>}
            <h3 className="serif mt-6 text-xl">Please avoid</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {avoid.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {themes.length > 0 && <li>Themes: {themes.join(", ").toLowerCase()}</li>}
              <li>War, partition, violence and loss, unless {sub} raises them</li>
              <li>Quizzing: &ldquo;Do you remember…?&rdquo;</li>
            </ul>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="serif text-2xl">Conversation starters{starters.length ? " that worked" : ""}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(starters.length ? starters : fallbackStarters).map((s) => (
              <li key={s} className="rounded-xl bg-paper px-4 py-3 text-ink-2 print:border print:border-line">
                &ldquo;{s}&rdquo;
              </li>
            ))}
          </ul>
        </section>

        {words.length > 0 && (
          <section className="mt-10">
            <h2 className="serif text-2xl">In {pos} own words</h2>
            <ul className="mt-3 space-y-1.5 text-ink-2">
              {words.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        {map.together && (map.together.pairs.length > 0 || map.together.then.length > 0) && (
          <section className="mt-10">
            <h2 className="serif text-2xl">Common ground with family</h2>
            <p className="text-sm text-ink-3">Where {pos} taste meets a younger family member&apos;s, according to Qloo</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {map.together.pairs.map((p) => (
                <li key={p.yours.id} className="rounded-xl bg-paper px-4 py-3 print:border print:border-line">
                  <span className="serif text-lg">{p.hers.name}</span>
                  <span className="text-ink-3"> and </span>
                  <span className="serif text-lg">{p.yours.name}</span>
                  {p.tags.length > 0 && <span className="block text-xs text-ink-3">{p.tags.join(" · ")}</span>}
                </li>
              ))}
            </ul>
            {map.together.then.length > 0 && (
              <p className="mt-3 text-sm text-ink-2">
                Good to enjoy together: {map.together.then.filter((x) => !upsetIds.has(x.entity.id)).slice(0, 5).map((x) => x.entity.name).join(", ")}.
              </p>
            )}
          </section>
        )}

        {map.home && map.home.dishes.length > 0 && (
          <section className="mt-10">
            <h2 className="serif text-2xl">Taste of {map.home.city.split(",")[0]}</h2>
            <p className="mt-2 text-ink-2">{map.home.dishes.slice(0, 8).join(" · ")}</p>
            {map.home.landmarks.length > 0 && (
              <p className="mt-1 text-sm text-ink-3">Places to talk about: {map.home.landmarks.slice(0, 5).map(titleCase).join(", ")}</p>
            )}
          </section>
        )}

        <footer className="mt-12 border-t border-line pt-4 text-xs text-ink-3">
          Made with Duet from {sessions.length} session{sessions.length === 1 ? "" : "s"}. Cultural data from Qloo. A
          conversation aid to keep with {pos} care plan, not medical advice.
        </footer>
      </article>
    </main>
  );
}

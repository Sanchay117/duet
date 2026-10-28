"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommonGround } from "@/components/CommonGround";
import { Shelf } from "@/components/Shelf";
import { Trace } from "@/components/Trace";
import { Chip, DOMAIN_META, Icon, Logo, Poster, Spinner, provenance } from "@/components/ui";
import { store, useLearned, useMap, usePerson, useSessions } from "@/lib/store";
import type { BuildEvent, Domain, Entity, HomeTaste, Person, Tag, Together, TraceStep } from "@/lib/types";

const SHELVES: Domain[] = ["music", "film", "tv", "stars", "books"];

interface LiveState {
  steps: TraceStep[];
  seeds?: Entity[];
  guessed?: Entity[];
  domains: Partial<Record<Domain, Entity[]>>;
  home?: HomeTaste;
  profile?: Tag[];
  together?: Together;
}

const empty = (): LiveState => ({ steps: [], domains: {} });

export default function MemoryMapPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const person = usePerson(id);
  const saved = useMap(id);
  const sessions = useSessions(id);
  const learned = useLearned(id);
  const [building, setBuilding] = useState(false);
  const [live, setLive] = useState<LiveState>(empty);
  const [error, setError] = useState("");
  const started = useRef(false);
  const inFlight = useRef<AbortController | null>(null);

  // `who` lets a just-saved edit build straight away, before the stored person is read back.
  // A new build replaces one still streaming, so two never write into the same view.
  const build = useCallback(
    async (withLearning: boolean, who?: Person) => {
      const p = who ?? person;
      if (!p) return;
      inFlight.current?.abort();
      const ctrl = new AbortController();
      inFlight.current = ctrl;
      setBuilding(true);
      setError("");
      setLive(empty());
      const l = store.learned(id);
      try {
        const res = await fetch("/api/build", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: p.id,
            birthYear: p.birthYear,
            hometown: p.hometown,
            about: p.about,
            language: p.language,
            pronoun: p.pronoun,
            family: p.family,
            ...(withLearning
              ? { sparks: l.sparks.map((s) => ({ name: s.name, kind: s.kind })), avoidIds: l.avoidIds }
              : {}),
          }),
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as BuildEvent;
            if (ev.type === "done") store.saveMap(ev.map);
            else if (ev.type === "error") setError(ev.message);
            else
              setLive((s) => {
                switch (ev.type) {
                  case "step":
                    return { ...s, steps: [...s.steps.filter((x) => x.id !== ev.step.id), ev.step] };
                  case "seeds":
                    return { ...s, seeds: ev.seeds, guessed: ev.guessed };
                  case "domain":
                    return { ...s, domains: { ...s.domains, [ev.domain]: ev.items } };
                  case "home":
                    return { ...s, home: ev.home };
                  case "profile":
                    return { ...s, profile: ev.tags };
                  case "together":
                    return { ...s, together: ev.together };
                }
                return s;
              });
          }
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message);
      } finally {
        if (inFlight.current === ctrl) setBuilding(false);
      }
    },
    [id, person],
  );

  useEffect(() => {
    if (person && saved === null && !started.current) {
      started.current = true;
      build(false);
    }
  }, [person, saved, build]);

  const view = building || !saved ? null : saved;
  const seeds = view?.seeds ?? live.seeds;
  const guessed = view?.guessed ?? live.guessed;
  const domains = view?.domains ?? live.domains;
  const home = view?.home ?? live.home;
  const profile = view?.profile ?? live.profile;
  const together = view ? view.together : live.together;
  const steps = view?.trace ?? live.steps;
  const names = useMemo(() => new Map([...(seeds ?? []), ...(guessed ?? [])].map((e) => [e.id, e.name])), [seeds, guessed]);
  const loves = useMemo(() => new Set((seeds ?? []).map((e) => e.id)), [seeds]);

  if (person === undefined) return null;
  if (person === null)
    return (
      <main className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <p className="serif text-3xl">This memory map isn&apos;t on this device.</p>
          <p className="mt-2 text-ink-2">Duet keeps everything in the browser where it was made.</p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-paper">
            Go home
          </Link>
        </div>
      </main>
    );

  const pr = person.pronoun === "he" ? "he" : person.pronoun === "they" ? "they" : "she";
  const pos = person.pronoun === "he" ? "his" : person.pronoun === "they" ? "their" : "her";
  const w = { from: person.birthYear + 10, to: Math.min(person.birthYear + 30, new Date().getFullYear()) };
  const sparks = learned?.sparks ?? [];

  return (
    <main className="grain flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {saved && !building && (
            <button
              onClick={() => build(sparks.length > 0)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3.5 py-2 text-ink-2 hover:text-ink"
            >
              <Icon name="refresh" size={15} /> Rebuild
              {sparks.length > 0 && <span className="hidden sm:inline">with what we learned</span>}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Remove ${person.name} and all sessions from this device?`)) {
                store.removePerson(id);
                router.push("/");
              }
            }}
            className="rounded-full px-3 py-2 text-ink-3 hover:text-rose"
          >
            Remove
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24">
        {/* Header */}
        <section className="grid gap-8 pb-10 pt-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rise">
            <p className="text-xs uppercase tracking-[0.25em] text-clay-2">Memory map</p>
            <h1 className="serif mt-2 text-5xl leading-none sm:text-6xl">{person.name}</h1>
            <p className="mt-4 text-lg text-ink-2">
              Born {person.birthYear} · grew up in {view?.place ?? person.hometown}
            </p>
            <p className="mt-1 text-ink-2">
              {pos[0].toUpperCase() + pos.slice(1)} memory years:{" "}
              <span className="serif text-xl text-clay-2">
                {w.from}–{w.to}
              </span>{" "}
              <span className="text-ink-3">(ages 10 to 30)</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(view?.language ?? person.language) && <Chip tone="clay">Prompts in {view?.language ?? person.language}</Chip>}
              {profile?.slice(0, 7).map((t) => (
                <Chip key={t.id}>{t.name.trim()}</Chip>
              ))}
            </div>
          </div>

          {/* Session card */}
          <div className="rise rounded-3xl bg-night p-6 text-paper shadow-[0_30px_80px_-40px_rgba(21,17,13,.9)]" style={{ animationDelay: "80ms" }}>
            {view ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-glow/80">Tonight</p>
                <p className="serif mt-2 text-3xl leading-tight">{view.session.length} cards, about 25 minutes</p>
                {view.session.some((c) => c.together) && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-glow">
                    <Icon name="pair" size={16} /> {view.session.filter((c) => c.together).length} of them for you both
                  </p>
                )}
                {view.opening && <p className="mt-3 text-sm leading-relaxed text-paper/75">{view.opening}</p>}
                <div className="mt-4 flex -space-x-3">
                  {view.session.slice(0, 6).map((c) => (
                    <Poster key={c.key} entity={c.entity} domain={c.domain} className="h-14 w-11 ring-2 ring-night" rounded="rounded-md" />
                  ))}
                </div>
                <Link
                  href={`/p/${id}/session`}
                  className="mt-6 flex items-center justify-center gap-2 rounded-full bg-glow px-6 py-3.5 text-lg font-medium text-night hover:bg-[#f7d29a]"
                >
                  <Icon name="play" size={18} /> Begin the session
                </Link>
                <Link href={`/p/${id}/care-card`} className="mt-3 block text-center text-sm text-paper/70 underline-offset-2 hover:text-paper hover:underline">
                  {pos[0].toUpperCase() + pos.slice(1)} care card
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-glow/80">The agent is working</p>
                <p className="serif mt-2 text-2xl leading-tight">Rebuilding {pos} world, {w.from} to {w.to}</p>
                <div className="mt-5 rounded-2xl bg-paper p-4 text-ink">
                  <Trace steps={steps ?? []} live />
                </div>
                {error && (
                  <p className="mt-4 rounded-xl bg-rose/20 px-3 py-2 text-sm">
                    {error}{" "}
                    <button className="underline" onClick={() => build(false)}>
                      Try again
                    </button>
                  </p>
                )}
                {!building && !error && <Spinner className="mt-4 text-glow" />}
              </>
            )}
          </div>
        </section>

        <CommonGround
          person={person}
          together={together}
          loves={loves}
          loading={building}
          onSave={(family) => {
            const next = { ...person, family };
            store.savePerson(next);
            build(sparks.length > 0, next);
          }}
        />

        {/* Starting points */}
        {(seeds?.length || guessed?.length) && (
          <section className="rise mb-12">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="serif text-2xl">Where the agent started</h2>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="flex flex-wrap gap-3">
              {seeds?.map((e) => (
                <StartChip key={e.id} e={e} label="You told us" tone="clay" by={person.birthYear} pr={pr} />
              ))}
              {guessed?.map((e) => (
                <StartChip key={e.id} e={e} label="Era anchor, verified in Qloo" tone="plain" by={person.birthYear} pr={pr} />
              ))}
              {sparks.map((e) => (
                <StartChip key={`s-${e.id}`} e={e} label="Lit up in a session" tone="sage" by={person.birthYear} pr={pr} />
              ))}
            </div>
          </section>
        )}

        <div className="space-y-12">
          {SHELVES.map((d) => (
            <Shelf
              key={d}
              domain={d}
              items={domains?.[d]}
              loading={building && !domains?.[d]}
              birthYear={person.birthYear}
              pronoun={pr}
              names={names}
            />
          ))}

          {home && (home.dishes.length > 0 || home.landmarks.length > 0) && (
            <section className="rise">
              <div className="mb-3 flex items-baseline gap-3">
                <h3 className="serif text-2xl">Taste of {home.city.split(",")[0]}</h3>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-ink-3">from Qloo place data</span>
              </div>
              <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm text-ink-3">Dishes the town is known for</p>
                    <div className="flex flex-wrap gap-2">
                      {home.dishes.slice(0, 10).map((d) => (
                        <span key={d} className="serif rounded-full bg-gold/15 px-3 py-1 text-[15px] text-[#7a5614]">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                  {home.landmarks.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm text-ink-3">Streets and landmarks</p>
                      <div className="flex flex-wrap gap-2">
                        {home.landmarks.slice(0, 8).map((d) => (
                          <Chip key={d}>{d.replace(/\b\w/g, (c) => c.toUpperCase())}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {home.places.slice(0, 6).map((p) => (
                    <figure key={p.id} className="rounded-xl border border-line bg-card p-2">
                      <Poster entity={p} domain="home" className="aspect-[4/3] w-full" rounded="rounded-lg" />
                      <figcaption className="mt-1.5 truncate px-1 text-xs text-ink-2">{p.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* History and provenance */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-card p-6">
            <h2 className="serif text-2xl">Sessions</h2>
            {sessions && sessions.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {sessions.map((s) => {
                  const joy = s.reactions.filter((r) => r.kind === "joy").length;
                  return (
                    <li key={s.id} className="py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium">{new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                        <span className="text-sm text-ink-3">
                          {s.reactions.length} cards · {joy} lit up
                        </span>
                      </div>
                      {s.summary && <p className="mt-1 text-sm text-ink-2">{s.summary}</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-ink-2">
                No sessions yet. After each one, Duet remembers what made {person.name} light up and what to avoid, and the next
                map gets better.
              </p>
            )}
          </div>
          <details className="group rounded-3xl border border-line bg-card p-6" open={false}>
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <span className="serif text-2xl">How the agent built this</span>
              <span className="text-sm text-clay-2 group-open:hidden">Show trace</span>
            </summary>
            <p className="mt-2 text-sm text-ink-3">
              Every cultural item above came from Qloo. The language model read your notes, proposed era anchors (each verified
              in Qloo or dropped), and wrote the conversation prompts.
            </p>
            <div className="mt-4">
              <Trace steps={steps ?? []} />
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

function StartChip({ e, label, tone, by, pr }: { e: Entity; label: string; tone: "clay" | "plain" | "sage"; by: number; pr: string }) {
  const d: Domain = e.kind === "artist" ? "music" : e.kind === "movie" ? "film" : e.kind === "tv_show" ? "tv" : e.kind === "book" ? "books" : "stars";
  const ring = tone === "clay" ? "border-clay/40" : tone === "sage" ? "border-sage/40" : "border-line";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-card py-2 pl-2 pr-4 ${ring}`}>
      <Poster entity={e} domain={d} className="h-12 w-12" rounded="rounded-lg" />
      <div>
        <div className="serif leading-tight">{e.name}</div>
        <div className="text-xs text-ink-3">
          <span style={{ color: tone === "clay" ? "var(--clay-2)" : tone === "sage" ? "var(--sage)" : undefined }}>{label}</span>
          {provenance(e, by, pr).length > 0 && ` · ${provenance(e, by, pr).join(" · ")}`}
          {" · "}
          {DOMAIN_META[d].noun}
        </div>
      </div>
    </div>
  );
}

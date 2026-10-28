"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip, DOMAIN_META, Icon, Logo, Poster, Spinner, provenance } from "@/components/ui";
import { VoiceButton } from "@/components/VoiceButton";
import { langCode, speak, stopSpeaking } from "@/lib/speech";
import { newId, store, useLearned, useMap, usePerson } from "@/lib/store";
import type { Card, Entity, Learned, Person, Reaction, ReactionKind, SessionLog } from "@/lib/types";

function newLog(personId: string): SessionLog {
  return { id: newId(), personId, startedAt: Date.now(), reactions: [] };
}

function withSummary(log: SessionLog): SessionLog {
  const rs = log.reactions;
  const joy = rs.filter((r) => r.kind === "joy").map((r) => r.entityName);
  return {
    ...log,
    summary: rs.length ? `Lit up at ${joy.length} of ${rs.length}${joy.length ? `: ${joy.slice(0, 4).join(", ")}` : ""}.` : undefined,
  };
}

const REACTIONS: { kind: ReactionKind; label: string; hint: string; icon: "sun" | "leaf" | "dot" | "cloud"; color: string; key: string }[] = [
  { kind: "joy", label: "Lit up", hint: "smiled, sang, talked", icon: "sun", color: "var(--glow)", key: "1" },
  { kind: "calm", label: "Calm", hint: "content, listening", icon: "leaf", color: "#9fb894", key: "2" },
  { kind: "none", label: "No response", hint: "didn't land", icon: "dot", color: "rgba(245,238,226,.6)", key: "3" },
  { kind: "distress", label: "Upset", hint: "restless, sad", icon: "cloud", color: "#e58b9c", key: "4" },
];

interface AgentNote {
  status: "thinking" | "done" | "error";
  text: string;
  added?: Card[];
}

function mediaLink(card: Card, person: Person) {
  const e = card.entity;
  const town = person.hometown.split(",")[0];
  if (card.domain === "home") return { href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${e.name} ${town}`)}`, label: "See pictures" };
  const q =
    card.domain === "film" || card.domain === "tv"
      ? `${e.name} ${e.year ?? ""} ${e.kind === "movie" ? "songs" : "opening theme"}`
      : card.domain === "books"
        ? `${e.name} audiobook reading`
        : `${e.name} ${e.year ?? ""}`;
  return { href: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`, label: card.domain === "film" ? "Songs and scenes on YouTube" : "Find it on YouTube" };
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const person = usePerson(id);
  const map = useMap(id);
  const learned = useLearned(id);
  // Cards the agent inserts mid-session live here; until then the deck is the planned session.
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [reactions, setReactions] = useState<Record<string, ReactionKind>>({});
  const [note, setNote] = useState("");
  const [agent, setAgent] = useState<AgentNote | null>(null);
  const [ended, setEnded] = useState(false);
  const [log, setLog] = useState<SessionLog>(() => newLog(id));

  const cards = useMemo(() => deck ?? map?.session ?? [], [deck, map]);
  const card = cards[i];
  const pr = person?.pronoun === "he" ? "he" : person?.pronoun === "they" ? "they" : "she";
  const obj = pr === "he" ? "him" : pr === "they" ? "them" : "her";
  const pos = pr === "he" ? "his" : pr === "they" ? "their" : "her";
  const lang = langCode(map?.language ?? person?.language);
  const names = useMemo(
    () => new Map([...(map?.seeds ?? []), ...(map?.guessed ?? []), ...(learned?.sparks ?? [])].map((e) => [e.id, e.name])),
    [map, learned],
  );

  // Persist every reaction as it happens, so closing the tab loses nothing.
  useEffect(() => {
    if (log.reactions.length) store.saveSession(log);
  }, [log]);
  useEffect(() => () => stopSpeaking(), []);

  const insertAfter = useCallback(
    (added: Card[]) => setDeck((d) => {
      const base = d ?? map?.session ?? [];
      return [...base.slice(0, i + 1), ...added, ...base.slice(i + 1)];
    }),
    [map, i],
  );

  const go = useCallback(
    (n: number) => {
      stopSpeaking();
      setNote("");
      if (n >= cards.length) setEnded(true);
      else setI(Math.max(0, n));
    },
    [cards.length],
  );

  const react = useCallback(
    async (kind: ReactionKind, spoken?: string) => {
      if (!card || !person || !map) return;
      const text = (spoken ?? note).trim();
      setReactions((r) => ({ ...r, [card.key]: kind }));
      const reaction: Reaction = {
        cardKey: card.key,
        entityId: card.entity.id,
        entityName: card.entity.name,
        domain: card.domain,
        kind,
        note: text || undefined,
        prompt: card.prompt,
        at: Date.now(),
      };
      setLog((l) => withSummary({ ...l, reactions: [...l.reactions.filter((r) => r.cardKey !== card.key), reaction] }));

      // What the agent learns persists across sessions.
      const l: Learned = { ...store.learned(id) };
      if (kind === "joy" && !l.sparks.some((s) => s.id === card.entity.id) && !card.entity.id.startsWith("home-")) {
        l.sparks = [...l.sparks, card.entity].slice(-12);
      }
      if (kind === "distress" && !l.avoidIds.includes(card.entity.id)) l.avoidIds = [...l.avoidIds, card.entity.id];
      // The latest reaction wins: something that upset them today is no longer a spark, and the reverse.
      if (kind === "distress") l.sparks = l.sparks.filter((s) => s.id !== card.entity.id);
      if (kind === "joy" || kind === "calm") l.avoidIds = l.avoidIds.filter((x) => x !== card.entity.id);
      if (text) l.notes = [...l.notes, `${card.entity.name}: ${text}`].slice(-30);
      store.saveLearned(id, l);

      if (kind === "none" && !text) {
        setAgent({ status: "done", text: "No response is fine. Some things land and some don't. Moving on gently." });
        setTimeout(() => go(i + 1), 700);
        return;
      }

      setAgent({
        status: "thinking",
        text:
          kind === "joy"
            ? `${pr[0].toUpperCase() + pr.slice(1)} lit up. Asking Qloo what sits closest to ${card.entity.name} in ${pos} years…`
            : kind === "distress"
              ? "Pause here. Put this away, soften your voice and stay close. Finding something soothing…"
              : text
                ? "Listening to what was said…"
                : "Finding a gentle next step…",
      });
      try {
        const res = await fetch("/api/adapt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            person: { birthYear: person.birthYear, pronoun: person.pronoun, language: map.language ?? person.language, place: map.place, life: map.life },
            window: map.window,
            seeds: [...map.seeds, ...map.guessed],
            sparks: l.sparks,
            avoidIds: l.avoidIds,
            avoidTags: l.avoidTags,
            seen: cards.map((c) => c.entity.id),
            reaction: { kind, entity: card.entity, domain: card.domain, note: text || undefined },
            calmPool: kind === "distress" ? map.domains.music : undefined,
          }),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out.error ?? "adapt failed");
        const next: Learned = { ...store.learned(id) };
        if (out.mentions?.length) {
          next.sparks = [...next.sparks, ...out.mentions.filter((m: Entity) => !next.sparks.some((s) => s.id === m.id))].slice(-12);
        }
        if (out.avoidTags?.length) next.avoidTags = [...next.avoidTags, ...out.avoidTags].slice(-12);
        store.saveLearned(id, next);
        const added: Card[] = out.cards ?? [];
        if (added.length) insertAfter(added);
        setNote("");
        setAgent({ status: "done", text: out.message, added });
      } catch {
        setAgent({ status: "error", text: "Couldn't reach the agent just now. The session continues as planned." });
      }
    },
    [card, person, map, note, cards, i, go, pr, pos, id, insertAfter],
  );

  const calmNow = useCallback(() => {
    if (!map || !person) return;
    const sparks = store.learned(id).sparks;
    const music: Entity | undefined =
      sparks.find((s) => s.kind === "artist") ?? map.seeds.find((s) => s.kind === "artist") ?? map.guessed.find((s) => s.kind === "artist");
    if (!music) return;
    const calm: Card = {
      key: `calm-${Date.now()}`,
      domain: "music",
      entity: music,
      why: `The most familiar voice we know of for ${obj}.`,
      prompt: "Let's just listen together for a little while.",
      cue: `Play softly, sit close, slow your own breathing, hold ${pos} hand if welcome.`,
      adaptedFrom: "calm now",
    };
    insertAfter([calm]);
    setAgent({ status: "done", text: `Calm now: switching to ${music.name}. No questions, just listening.` });
    stopSpeaking();
    setI(i + 1);
  }, [map, person, i, obj, pos, id, insertAfter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const r = REACTIONS.find((x) => x.key === e.key);
      if (r) react(r.kind);
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [react, go, i]);

  if (person === undefined || map === undefined) return <main className="flex-1 bg-night" />;
  if (!person || !map)
    return (
      <main className="grid flex-1 place-items-center bg-night p-10 text-center text-paper">
        <div>
          <p className="serif text-3xl">No session found on this device.</p>
          <Link href={person ? `/p/${id}` : "/"} className="mt-6 inline-block rounded-full bg-glow px-5 py-2.5 text-night">
            {person ? "Build the memory map first" : "Go home"}
          </Link>
        </div>
      </main>
    );

  if (ended) return <EndScreen id={id} person={person} log={log} learned={learned ?? store.learned(id)} cards={cards} />;
  if (!card) return null;

  const meta = DOMAIN_META[card.domain];
  const because = card.entity.because?.map((x) => names.get(x)).filter(Boolean)[0];
  const media = mediaLink(card, person);
  const reacted = reactions[card.key];

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-night text-paper">
      {/* Ambient glow from the poster */}
      {card.entity.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.entity.image} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.13] blur-3xl" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(242,194,123,.10),transparent_60%)]" />

      <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-4">
          <Link href={`/p/${id}`} aria-label="Back to memory map">
            <Logo light size={18} />
          </Link>
          <span className="hidden text-sm text-paper/60 sm:inline">with {person.name}</span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex" aria-label={`Card ${i + 1} of ${cards.length}`}>
          {cards.map((c, n) => (
            <button
              key={c.key}
              onClick={() => go(n)}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-glow" : reactions[c.key] === "joy" ? "w-1.5 bg-glow/70" : c.adaptedFrom ? "w-1.5 bg-[#9fb894]" : "w-1.5 bg-white/25"}`}
              aria-label={`Go to card ${n + 1}: ${c.entity.name}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={calmNow} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#9fb894]/50 px-3 py-1.5 text-sm text-[#cfe0c6] hover:bg-[#9fb894]/10">
            <Icon name="heart" size={15} /> Calm now
          </button>
          <button
            onClick={() => setEnded(true)}
            className="rounded-full px-3 py-1.5 text-sm text-paper/60 hover:text-paper"
          >
            End
          </button>
        </div>
      </header>

      <section key={card.key} className="rise relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-5 pb-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex justify-center">
          <Poster entity={card.entity} domain={card.domain} big className="aspect-[3/4] h-[34vh] w-auto shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] sm:h-auto sm:w-full sm:max-w-[340px] lg:max-h-[62vh] lg:w-auto" rounded="rounded-2xl" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="dark">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} /> {meta.noun}
            </Chip>
            {provenance(card.entity, person.birthYear, pr).map((t) => (
              <Chip key={t} tone="dark">
                {t}
              </Chip>
            ))}
            {because && <Chip tone="dark">Qloo link: {because}</Chip>}
            {card.together && (
              <span className="inline-flex items-center gap-1 rounded-full bg-glow/15 px-2.5 py-0.5 text-xs text-glow">
                <Icon name="pair" size={13} /> For you both
              </span>
            )}
            {card.adaptedFrom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#9fb894]/20 px-2.5 py-0.5 text-xs text-[#d6e6cd]">
                <Icon name="spark" size={12} /> New, from {card.adaptedFrom}
              </span>
            )}
          </div>

          <h1 className="serif mt-4 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">{card.entity.name}</h1>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.2em] text-glow/80">Say to {obj}</p>
              <button
                onClick={() => speak(card.promptNative ?? card.prompt, card.promptNative ? lang : "en-US")}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm text-paper/70 hover:text-paper"
              >
                <Icon name="speaker" size={16} /> Read aloud
              </button>
            </div>
            <p className="serif mt-2 text-2xl leading-snug text-glow sm:text-3xl">{card.prompt}</p>
            {card.promptNative && (
              <p className="mt-3 text-xl leading-relaxed text-paper/85 sm:text-2xl" lang={lang}>
                {card.promptNative}
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-2 text-sm text-paper/70">
            {card.why && <p>{card.why}</p>}
            {card.cue && (
              <p className="flex items-start gap-2 text-paper/85">
                <Icon name="arrow-right" size={16} className="mt-0.5 shrink-0 text-glow" /> {card.cue}
              </p>
            )}
          </div>

          <div className="mt-5">
            {card.entity.spotify && card.domain !== "home" ? (
              <iframe
                title={`${card.entity.name} on Spotify`}
                src={`https://open.spotify.com/embed/artist/${card.entity.spotify}?utm_source=duet&theme=0`}
                className="h-[152px] w-full rounded-xl border-0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <a
                href={media.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
              >
                <Icon name="play" size={14} /> {media.label} <Icon name="external" size={14} className="opacity-60" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Agent panel */}
      {agent && (
        <div className="relative z-10 mx-auto mb-3 w-full max-w-6xl px-5">
          <div className="rise flex items-start gap-3 rounded-2xl border border-white/10 bg-night-2/90 p-4 backdrop-blur">
            <span className="mt-0.5 text-glow">{agent.status === "thinking" ? <Spinner /> : <Icon name="spark" size={18} />}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-paper/90">{agent.text}</p>
              {agent.added && agent.added.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {agent.added.map((c) => (
                    <button key={c.key} onClick={() => go(cards.findIndex((x) => x.key === c.key))} className="flex items-center gap-2 rounded-xl bg-white/5 py-1.5 pl-1.5 pr-3 text-left hover:bg-white/10">
                      <Poster entity={c.entity} domain={c.domain} className="h-10 w-8" rounded="rounded-md" />
                      <span>
                        <span className="block text-sm leading-tight">{c.entity.name}</span>
                        <span className="text-xs text-paper/50">{DOMAIN_META[c.domain].noun} · up next</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setAgent(null)} className="text-paper/40 hover:text-paper" aria-label="Dismiss">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <footer className="relative z-10 border-t border-white/10 bg-night/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REACTIONS.map((r) => (
              <button
                key={r.kind}
                onClick={() => react(r.kind)}
                disabled={agent?.status === "thinking"}
                className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                  reacted === r.kind ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/5"
                }`}
                aria-keyshortcuts={r.key}
              >
                <span style={{ color: r.color }}>
                  <Icon name={r.icon} size={26} />
                </span>
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-paper/50">{r.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-4 pr-1">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && note.trim() && react(reactions[card.key] ?? "joy")}
                placeholder={`What did ${pr} say? e.g. "${pr === "he" ? "He" : "She"} sang along and mentioned a film"`}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-paper outline-none placeholder:text-paper/35"
              />
              <VoiceButton dark label="Speak" onText={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button onClick={() => go(i - 1)} disabled={i === 0} className="rounded-full p-3 text-paper/70 hover:bg-white/10 disabled:opacity-30" aria-label="Previous card">
                <Icon name="arrow-left" />
              </button>
              <span className="text-sm tabular-nums text-paper/50">
                {i + 1} / {cards.length}
              </span>
              <button onClick={() => go(i + 1)} className="inline-flex items-center gap-2 rounded-full bg-glow px-5 py-3 font-medium text-night hover:bg-[#f7d29a]">
                {i + 1 === cards.length ? "Finish" : "Next"} <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function EndScreen({ id, person, log, learned, cards }: { id: string; person: Person; log: SessionLog | null; learned: Learned; cards: Card[] }) {
  const rs = log?.reactions ?? [];
  const count = (k: ReactionKind) => rs.filter((r) => r.kind === k).length;
  const joyCards = cards.filter((c) => rs.some((r) => r.cardKey === c.key && r.kind === "joy"));
  return (
    <main className="grid min-h-dvh flex-1 place-items-center bg-night px-5 py-16 text-paper">
      <div className="rise w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-glow/80">Session complete</p>
        <h1 className="serif mt-3 text-5xl">Thank you for sitting with {person.name}.</h1>
        <div className="mt-8 grid grid-cols-4 gap-3">
          {REACTIONS.map((r) => (
            <div key={r.kind} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <span style={{ color: r.color }} className="inline-block">
                <Icon name={r.icon} size={24} />
              </span>
              <div className="serif mt-1 text-3xl">{count(r.kind)}</div>
              <div className="text-xs text-paper/60">{r.label}</div>
            </div>
          ))}
        </div>
        {joyCards.length > 0 && (
          <div className="mt-8">
            <p className="text-sm text-paper/70">What brought {person.name} back today</p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {joyCards.map((c) => (
                <div key={c.key} className="w-24">
                  <Poster entity={c.entity} domain={c.domain} className="aspect-[3/4] w-full" />
                  <p className="mt-1.5 truncate text-xs">{c.entity.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mx-auto mt-8 max-w-lg text-sm text-paper/60">
          Duet saved {learned.sparks.length} spark{learned.sparks.length === 1 ? "" : "s"} and {learned.avoidIds.length} thing
          {learned.avoidIds.length === 1 ? "" : "s"} to avoid. Rebuild the memory map to fold them into the next session.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/p/${id}/care-card`} className="inline-flex items-center gap-2 rounded-full bg-glow px-6 py-3 font-medium text-night">
            <Icon name="print" size={18} /> Open the care card
          </Link>
          <Link href={`/p/${id}`} className="rounded-full border border-white/20 px-6 py-3 hover:bg-white/10">
            Back to the memory map
          </Link>
        </div>
      </div>
    </main>
  );
}

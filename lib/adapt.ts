// Mid-session adaptation. A reaction (and optionally what the person said) becomes a new
// Qloo query: a smile pulls the taste graph toward that item, distress steers away from
// its themes, and anything the person mentions out loud becomes a fresh signal.
import { chatJSON } from "./groq";
import { insights, search } from "./qloo";
import { ageAt, artistInEra, heavyTheme, sameName } from "./era";
import { asInvitation, domainOf, forPrompt, PROMPT_RULES, pronounOf } from "./build";
import type { Card, Domain, Entity, EntityKind, ReactionKind, Tag, Window } from "./types";

export interface AdaptInput {
  person: { birthYear: number; pronoun?: "she" | "he" | "they"; language?: string; place?: string; life?: string[] };
  window: Window;
  seeds: Entity[];
  sparks: Entity[];
  avoidIds: string[];
  avoidTags: Tag[];
  seen: string[];
  reaction: { kind: ReactionKind; entity: Entity; domain: Domain; note?: string };
  /** The map's music shelf: Qloo picks already checked for era, ready to use without a round trip. */
  calmPool?: Entity[];
}

export interface AdaptOutput {
  message: string;
  cards: Card[];
  spark?: Entity;
  mentions: Entity[];
  avoidTags: Tag[];
  requests: string[];
}

const KIND_OF: Record<Domain, EntityKind> = {
  music: "artist",
  film: "movie",
  tv: "tv_show",
  stars: "person",
  books: "book",
  home: "artist",
};

/** Where a smile should send us next: one more of the same, one across domains. */
const CROSS: Record<Domain, EntityKind> = {
  music: "movie",
  film: "artist",
  tv: "artist",
  stars: "movie",
  books: "movie",
  home: "artist",
};

const SAD = /tragic|tragedy|sad|melanchol|death|loss|heartbreak|grief|dark|violen|crime|war|longing|lonel|mourn|tear|bitter|haunting|revenge/i;
const SOOTHING = /sooth|calm|gentle|mellow|tender|peace|warm|serene|melod|lullab|devotion|smooth|comfort/i;

function eraFilter(kind: EntityKind, by: number, w: Window): Record<string, string | number> {
  if (kind === "movie" || kind === "tv_show") return { "filter.release_year.min": w.from - 1, "filter.release_year.max": w.to };
  if (kind === "person") return { "filter.date_of_birth.min": `${by - 40}-01-01`, "filter.date_of_birth.max": `${by + 2}-12-31` };
  if (kind === "book") return { "filter.publication_year.min": w.from - 5, "filter.publication_year.max": w.to };
  return {};
}

async function extractMentions(note: string, by: number): Promise<{ name: string; kind: string; year?: number }[]> {
  const r = await chatJSON<{ mentions?: { name: string; kind: string; year?: number }[] }>(
    [
      {
        role: "system",
        content:
          "Extract named cultural items (singers, bands, songs' performers, films, TV shows, books, actors) from a caregiver's note about what a person living with dementia said or did. Reply with JSON {mentions:[{name, kind, year?}]} where kind is artist, movie, tv_show, book or person. Empty list if none. Do not guess beyond the note.",
      },
      { role: "user", content: JSON.stringify({ born: by, note }) },
    ],
    { temperature: 0.1, maxTokens: 600, fast: true },
  );
  return (r.mentions ?? []).slice(0, 3);
}

export async function adapt(a: AdaptInput): Promise<AdaptOutput> {
  const by = a.person.birthYear;
  const w = a.window;
  const { kind, entity, domain, note } = a.reaction;
  const requests: string[] = [];
  const seen = new Set([...a.seen, ...a.avoidIds, entity.id]);
  const fresh = (list: Entity[], k: EntityKind) =>
    list.filter(
      (e) =>
        !seen.has(e.id) &&
        !heavyTheme(e) &&
        !a.seeds.some((s) => s.id !== e.id && sameName(s.name, e.name) && k === "artist") &&
        (k !== "artist" || artistInEra(e, by, w)),
    );

  // 1. Anything said out loud is the strongest signal there is. Not when upset, though:
  // whatever gets named then may be the very thing that hurts.
  let mentions: Entity[] = [];
  if (note && note.trim().length > 3 && kind !== "distress") {
    try {
      const ms = await extractMentions(note, by);
      const found = await Promise.all(
        ms.map(async (m) => {
          const k = (["artist", "movie", "tv_show", "book", "person"].includes(m.kind) ? m.kind : "artist") as EntityKind;
          const r = await search(m.name, [k], 4);
          requests.push(r.request);
          return r.data.find((e) => e.kind === k);
        }),
      );
      mentions = found.filter((e): e is Entity => !!e);
    } catch {
      mentions = [];
    }
  }

  const positive = kind === "joy" || kind === "calm";
  const spark = positive ? entity : undefined;
  const signalIds = [
    ...mentions.map((e) => e.id),
    ...(positive && !entity.id.startsWith("home-") ? [entity.id] : []),
    ...a.sparks.slice(-3).map((e) => e.id),
  ];
  const fallbackSeeds = a.seeds.map((e) => e.id);
  const seeds = [...new Set(signalIds.length ? signalIds : fallbackSeeds)].slice(0, 8);

  // 2. Distress: hold back the themes this item carries, then go somewhere soothing.
  const avoidTags: Tag[] = kind === "distress" ? (entity.tags ?? []).filter((t) => SAD.test(t.name)).slice(0, 4) : [];
  const excludeTags = [...a.avoidTags, ...avoidTags].map((t) => t.id);

  type Pick = { e: Entity; d: Domain; reason: string };
  const picks: Pick[] = mentions.filter((m) => !seen.has(m.id)).map((e) => ({ e, d: domainOf(e), reason: "mentioned" }));

  const query = async (k: EntityKind, take: number) => {
    const r = await insights({
      kind: k,
      seeds,
      excludeIds: [...seen].filter((id) => !id.startsWith("home-")),
      excludeTags,
      filter: eraFilter(k, by, w),
      take,
      explain: true,
    });
    requests.push(r.request);
    return fresh(r.data, k);
  };

  if (kind === "joy") {
    const same = KIND_OF[domain];
    const cross = CROSS[domain];
    const [a1, a2] = await Promise.all([query(same, 15), cross === same ? Promise.resolve([]) : query(cross, 15)]);
    if (a1[0]) picks.push({ e: a1[0], d: domainOf(a1[0]), reason: "more like it" });
    const c = a2.find((e) => !picks.some((p) => p.e.id === e.id));
    if (c) picks.push({ e: c, d: domainOf(c), reason: "across domains" });
  } else if (kind === "calm") {
    const r = await query(KIND_OF[domain], 10);
    if (r[0]) picks.push({ e: r[0], d: domainOf(r[0]), reason: "gentle continuation" });
  } else if (kind === "distress") {
    // A live Qloo query takes seconds; an upset person shouldn't wait for it. The music shelf
    // was built from the same taste graph, so try it first and only query when it runs dry.
    const soothingOf = (list: Entity[]) => list.find((e) => (e.tags ?? []).some((t) => SOOTHING.test(t.name))) ?? list[0];
    const pool = fresh(a.calmPool ?? [], "artist").filter((e) => !(e.tags ?? []).some((t) => excludeTags.includes(t.id)));
    const soothing = soothingOf(pool) ?? soothingOf(await query("artist", 20));
    if (soothing) picks.push({ e: soothing, d: "music", reason: "soothing" });
  }

  if (!picks.length) {
    return {
      message:
        kind === "none"
          ? "No response is fine. Some items land and some don't. Moving on gently."
          : "Nothing new to add right now; continuing with the plan.",
      cards: [],
      spark,
      mentions,
      avoidTags,
      requests,
    };
  }

  const pr = pronounOf(a.person.pronoun);
  const names = new Map([...a.seeds, ...a.sparks, entity, ...mentions].map((e) => [e.id, e.name]));

  // Distress needs an answer now, not after another model call, and the card asks nothing.
  if (kind === "distress") {
    const p = picks[0];
    const via = p.e.because?.map((id) => names.get(id)).find(Boolean);
    const Sub = pr.sub[0].toUpperCase() + pr.sub.slice(1);
    const themes = avoidTags
      .map((t) => t.name.toLowerCase())
      .filter((t, i, all) => all.findIndex((x) => x.slice(0, 4) === t.slice(0, 4)) === i);
    return {
      message:
        `${Sub} became upset at ${entity.name}, so it's set aside` +
        (themes.length ? `, along with themes like ${themes.slice(0, 2).join(" and ")}` : "") +
        `. Next is ${p.e.name}${via ? `, which Qloo links to ${via}` : ""}. Pause first, no questions for now.`,
      cards: [
        {
          key: `${p.e.id}-a${Date.now()}-0`,
          domain: "music",
          entity: p.e,
          why: via ? `Qloo's taste graph links ${p.e.name} to ${via}, which ${pr.sub} already loves.` : `A gentle voice from ${pr.pos} years.`,
          prompt: "Let's just listen together for a little while.",
          cue: `Put ${entity.name} away. Play this softly, sit close, slow your own breathing, and hold ${pr.pos} hand if welcome.`,
          adaptedFrom: entity.name,
        },
      ],
      mentions: [],
      avoidTags,
      requests,
    };
  }

  // 3. Write the new cards in the same voice as the session.
  const known = new Set(mentions.map((e) => e.id));
  type Written = { message?: string; cards?: { id: string; prompt?: string; native?: string; cue?: string }[] };
  let written: Written = {};
  try {
    written = await chatJSON<Written>(
      [
        {
          role: "system",
          content:
            "You are Duet, a reminiscence therapy assistant guiding a family caregiver live, during a session with a person living with dementia. " +
            "Write cards only from the given data. Never invent facts. Reply with JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            person: {
              born: by,
              grew_up_in: a.person.place,
              pronoun: pr.sub,
              heart_language: a.person.language ?? null,
              life_notes: a.person.life ?? [],
            },
            just_happened: {
              item: entity.name,
              reaction: { joy: "lit up", calm: "was calm and content", none: "did not respond", distress: "became upset" }[kind],
              caregiver_note: note || null,
            },
            new_items: picks.map((p, i) => ({ ...forPrompt(p.e, p.d, by, known, names), id: `n${i}`, picked_because: p.reason })),
            output: {
              message: `One or two sentences to the caregiver explaining what you changed and why, citing the reaction and Qloo's link (e.g. 'She lit up at Kishore Kumar, so Qloo's taste graph brings in Padosan, where he starred.'). For distress, reassure and suggest pausing on something soothing.`,
              cards: "One object {id, prompt, native, cue} per new item, same order.",
            },
            // The why line is built from data afterwards, so only the spoken rules apply here.
            rules: PROMPT_RULES(pr).filter((r) => !r.startsWith("why:")),
          }),
        },
      ],
      { temperature: 0.6, maxTokens: 2000 },
    );
  } catch {
    written = {};
  }

  const cards: Card[] = picks.map((p, i) => {
    const wc = written.cards?.find((c) => c.id === `n${i}`) ?? written.cards?.[i];
    const said = asInvitation(wc?.prompt ?? `Tell me about ${p.e.name}. What was it like?`, wc?.native, p.e.name);
    const via = (p.e.because ?? []).map((id) => names.get(id)).filter(Boolean).slice(0, 2);
    // Built from data, like the planned cards, so the reason always matches the facts.
    const why =
      p.reason === "mentioned"
        ? `${pr.sub[0].toUpperCase() + pr.sub.slice(1)} brought this up just now.`
        : via.length
          ? `Qloo's taste graph links it to ${via.join(" and ")}.`
          : `Qloo's next step from ${entity.name}.`;
    return {
      key: `${p.e.id}-a${Date.now()}-${i}`,
      domain: p.d,
      entity: p.e,
      ageThen: ageAt(p.e.year, by),
      why,
      prompt: said.prompt,
      promptNative: said.native,
      cue: wc?.cue,
      adaptedFrom: p.reason === "mentioned" ? "their own words" : entity.name,
    };
  });

  return {
    message: written.message ?? `Following ${pr.pos} lead from ${entity.name}.`,
    cards,
    spark,
    mentions,
    avoidTags,
    requests,
  };
}

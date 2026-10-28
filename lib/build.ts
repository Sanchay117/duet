// The Duet agent: turns a family's few sentences into an era-locked memory map, the common
// ground between two generations' tastes, and a first session to share. Every cultural item
// comes from Qloo; the LLM only understands, hypothesizes (then Qloo verifies), and writes
// the conversation.
import { domainOf } from "./domain";
import { chatJSON } from "./groq";
import { insights, placesNear, search, tasteProfile, type QlooResult, type RawEntity } from "./qloo";
import { ageAt, artistInEra, bumpWindow, decadeTags, heavyTheme, inWindow, isHeavy, peakBoost, sameName } from "./era";
import { findTogether, yearsOf, yourShelf } from "./together";
import type { BuildEvent, Card, Domain, Entity, EntityKind, HomeTaste, MemoryMap, Person, Tag, TraceStep, Window } from "./types";

export type BuildInput = Pick<Person, "id" | "birthYear" | "hometown" | "about" | "language" | "pronoun" | "family"> & {
  /** What earlier sessions learned: items that made them light up, and items to keep away. */
  sparks?: { name: string; kind: EntityKind }[];
  avoidIds?: string[];
};
type Emit = (e: BuildEvent) => void;

interface Mention {
  name: string;
  kind: string;
  year?: number;
}

interface Understanding {
  place?: string;
  country?: string;
  language?: string | null;
  reader?: boolean;
  local_cuisines?: string[];
  local_dishes?: string[];
  favorites?: Mention[];
  anchors?: Mention[];
  life?: string[];
  family_favorites?: Mention[];
}

const KIND: Record<string, EntityKind> = {
  artist: "artist",
  singer: "artist",
  band: "artist",
  musician: "artist",
  composer: "artist",
  movie: "movie",
  film: "movie",
  tv: "tv_show",
  tv_show: "tv_show",
  show: "tv_show",
  series: "tv_show",
  book: "book",
  novel: "book",
  person: "person",
  actor: "person",
  actress: "person",
  star: "person",
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

export function pronounOf(p?: string) {
  if (p === "he") return { sub: "he", obj: "him", pos: "his" };
  if (p === "they") return { sub: "they", obj: "them", pos: "their" };
  return { sub: "she", obj: "her", pos: "her" };
}

/** Wraps a unit of work as a visible trace step. */
function tracer(emit: Emit, trace: TraceStep[]) {
  return async function step<T>(
    id: string,
    label: string,
    fn: () => Promise<{ value: T; detail?: string; request?: string; warn?: boolean }>,
  ): Promise<T | undefined> {
    const t0 = Date.now();
    emit({ type: "step", step: { id, label, status: "run" } });
    let done: TraceStep;
    let value: T | undefined;
    try {
      const r = await fn();
      value = r.value;
      done = { id, label, status: r.warn ? "warn" : "ok", detail: r.detail, request: r.request, ms: Date.now() - t0 };
    } catch (e) {
      done = { id, label, status: "warn", detail: (e as Error).message.slice(0, 160), ms: Date.now() - t0 };
    }
    trace.push(done);
    emit({ type: "step", step: done });
    return value;
  };
}

async function understand(p: BuildInput, w: Window): Promise<Understanding> {
  return chatJSON<Understanding>(
    [
      {
        role: "system",
        content:
          "You help a family caregiver of a person living with dementia prepare reminiscence sessions. " +
          "You extract cultural signals and propose era anchors. Every item you name will be checked against a cultural database, so only name real, widely known works and artists. Reply with JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Read the caregiver's notes and return JSON with keys place, country, language, reader, local_cuisines, local_dishes, favorites, anchors, life, family_favorites.",
          born: p.birthYear,
          grew_up_in: p.hometown,
          formative_years: `${w.from}-${w.to}`,
          caregiver_notes: p.about || "(none)",
          stated_language: p.language || null,
          family_member_loves: p.family?.loves || null,
          rules: {
            place: "Normalized 'City, Region, Country' for where they grew up.",
            country: "Full English country name of where they grew up, e.g. 'India', 'United States', 'United Kingdom'.",
            language:
              "Their heart language for conversation if it is not English (e.g. 'Hindi', 'Spanish', 'Tamil'), inferred from notes or hometown; null if English or unclear. Use stated_language if given.",
            reader: "true only if the notes suggest they enjoyed reading books.",
            local_cuisines:
              "1 to 3 single words naming the traditional cuisine of where they grew up, as restaurant guides tag it, e.g. ['Mexican','Jaliscan'], ['Awadhi','North Indian','Mughlai'], ['Southern','Soul food','Barbecue'].",
            local_dishes:
              "Up to 8 traditional dishes of where they grew up, spelled as locals write them, e.g. Guadalajara: ['torta ahogada','birria','carne en su jugo','pozole','jericalla']. Home cooking and street food from formative_years, not restaurant trends.",
            favorites:
              "Every specific artist, band, film, TV show, book or famous person named in the notes, as {name, kind, year?}. kind is one of artist, movie, tv_show, book, person. If a song is named, add its performing artist (and its film, for film songs). Do not invent favorites.",
            anchors:
              "6 items that were hugely popular where they grew up during formative_years and fit the notes (language, community, tastes): about 3 artists and 3 films (TV shows only where TV was common then). Joyful, warm, famous and verifiable; avoid war or tragedy. Do not repeat favorites. Each {name, kind, year}.",
            life: "Up to 5 short non-cultural facts from the notes useful in conversation (work, family roles, hobbies, places). No names of private people.",
            family_favorites:
              "Every artist, band, film or TV show named in family_member_loves (the younger family member's own taste, not the person's), as {name, kind, year?} where kind is exactly one of artist, movie, tv_show. Empty list if none. Do not invent any.",
          },
        }),
      },
    ],
    { temperature: 0.4, maxTokens: 1800 },
  );
}

/**
 * The candidate that is this mention. `era` also requires it to sit in the window (for anchors the
 * model proposed); `fallback` settles for the top result of the right kind when no name is close.
 */
function pickMatch(cands: Entity[], m: Mention, kinds: EntityKind[], w: Window, o: { era: boolean; fallback: boolean }): Entity | undefined {
  const want = norm(m.name);
  const sameKind = cands.filter((c) => kinds.includes(c.kind));
  // "El Chavo" may stand for "El Chavo del Ocho", but a film called "Pedro" is not Pedro Infante:
  // a shorter name must be most of the longer one, or more than a single word.
  const close = sameKind.filter((c) => {
    const n = norm(c.name);
    const shorter = n.length < want.length ? c.name : m.name;
    const near = Math.min(n.length, want.length) / Math.max(n.length, want.length) >= 0.6 || shorter.trim().split(/\s+/).length > 1;
    return n === want || (want.length > 4 && near && (n.startsWith(want) || want.startsWith(n)));
  });
  // An unverified anchor must also sit in the era, so a 2000 re-release cannot stand in for a 1970 film.
  const eraOk = (c: Entity) => !o.era || c.year === undefined || inWindow(c.year, w, 5);
  // The exact name beats a near one: "Luis Miguel: The Series" is the show, not the singer.
  const exact = close.filter((c) => norm(c.name) === want);
  const pool = (exact.length ? exact : close.length ? close : o.fallback ? sameKind.slice(0, 1) : []).filter(eraOk);
  if (!pool.length) return undefined;
  // Prefer the version from their era: "Aradhana" (1969), not the 1987 remake.
  const score = (c: Entity) =>
    (c.popularity ?? 0) +
    (m.year && c.year ? -Math.abs(c.year - m.year) / 8 : 0) +
    (c.kind !== "artist" && c.kind !== "person" && inWindow(c.year, w, 6) ? 0.4 : 0);
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

/** A plain list like "Arijit Singh, La La Land and Gilmore Girls", for when the model reads nothing in it. */
function splitLoves(text: string): Mention[] {
  return text
    .split(/,|;|\n|\s+&\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 6)
    .map((name) => ({ name, kind: "any" }));
}

async function resolveAll(mentions: Mention[], w: Window, strict: boolean) {
  const results = await Promise.all(
    mentions.slice(0, 10).map(async (m) => {
      // "TV show" or "animated film" reads as no kind at all, so look across the usual three.
      const named = KIND[(m.kind ?? "").toLowerCase().replace(/[^a-z]+/g, "_")];
      const kinds: EntityKind[] = named ? [named] : ["artist", "movie", "tv_show"];
      try {
        const r = await search(m.name, kinds, 6);
        const exact = pickMatch(r.data, m, kinds, w, { era: strict, fallback: false });
        if (exact || strict) return { m, e: exact };
        // "Pedro Infante films" may come back as a film; the name may still be a person or a singer.
        const all: EntityKind[] = ["artist", "person", "movie", "tv_show"];
        const wide = await search(m.name, all, 8);
        return {
          m,
          e: pickMatch(wide.data, m, all, w, { era: false, fallback: false }) ?? pickMatch(r.data, m, kinds, w, { era: false, fallback: true }),
        };
      } catch {
        return { m, e: undefined };
      }
    }),
  );
  const seen = new Set<string>();
  const found: Entity[] = [];
  const missed: string[] = [];
  for (const { m, e } of results) {
    if (!e) missed.push(m.name);
    else if (!seen.has(e.id)) {
      seen.add(e.id);
      found.push(e);
    }
  }
  return { found, missed };
}

const DISH_TYPES = ["urn:tag:specialty_dish:place", "urn:tag:menu_highlight:qloo"];
const GENERIC = new Set([
  "dishes", "toast", "seafood", "cuisine", "restaurant", "vegetarian", "non veg", "breakfast", "lunch", "dinner",
  "desserts", "dessert", "coffee", "tea", "salad", "fries", "chicken tenders", "veg", "pizza", "burger", "pasta",
]);
// Landmarks should be ones a person could have walked past in their youth.
const MODERN_PLACE = /metro|mall|airport|multiplex|it park|tech park|expressway|museum|memorial|arena|forum/i;

// "Mutton biryani", "Mutton dum biryani", "Awadhi chicken biryani": two of a kind are plenty.
function varied(dishes: string[], max: number) {
  const uses = new Map<string, number>();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dishes) {
    const words = d.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").split(/\s+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ""));
    const key = words.join(" ") || d.toLowerCase();
    const contained = [...seen].some((s) => key.includes(s) || s.includes(key));
    if (contained || words.some((w) => (uses.get(w) ?? 0) >= 2)) continue;
    seen.add(key);
    for (const w of words) uses.set(w, (uses.get(w) ?? 0) + 1);
    out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

// "Hazratganj" and "Hazratganj market" are one place to talk about.
function distinctPlaces(names: string[], max: number) {
  const out: string[] = [];
  for (const n of names) {
    const k = norm(n);
    if (out.some((o) => k.includes(norm(o)) || norm(o).includes(k))) continue;
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

// Cuisines that mark a kitchen as something other than the town's own, unless the town's
// own cuisine is one of them.
const ELSEWHERE = /steak|brazil|argentin|uruguay|burger|pizza|italian|japanese|ramen|sushi|chinese|asian|fusion|international|european|australian|french/i;

function aggregateHome(raw: RawEntity[], city: string, localCuisines: string[], localDishes: string[]): HomeTaste {
  const heritage = (e: RawEntity) =>
    (e.tags ?? []).some(
      (t) => /historic|traditional|classic|iconic|vintage|old|authentic|regional/i.test(t.name) && /setting|decor|ambience|culinary/.test(t.type ?? ""),
    );
  const isLocal = (name: string) => localCuisines.some((c) => name.toLowerCase().includes(c.toLowerCase()));
  // Qloo tags plenty of Brazilian steakhouses in Guadalajara "Mexican" too, so a kitchen only
  // counts as the town's own when nothing from elsewhere sits beside its local cuisine.
  const local = (e: RawEntity) => {
    const cuisines = (e.tags ?? []).filter((t) => t.type === "urn:tag:cuisine:qloo").map((t) => t.name);
    return cuisines.some(isLocal) && !cuisines.some((c) => ELSEWHERE.test(c) && !isLocal(c));
  };
  // Dishes the agent knows as the town's own rank first when Qloo's kitchens actually serve them.
  const known = localDishes.map(norm).filter((d) => d.length >= 4);
  const traditional = (dish: string) => {
    const n = norm(dish);
    return known.some((d) => n.includes(d) || d.includes(n));
  };
  // A dish counts for more when it comes from a traditional kitchen serving the local cuisine,
  // so Guadalajara gives carne en su jugo before tomahawk steak.
  const weight = (e: RawEntity) => 1 + (heritage(e) ? 1.5 : 0) + (local(e) ? 2 : 0) + (e.popularity ?? 0);
  // Where the town has enough kitchens of its own, dishes come only from them: a steakhouse
  // cut that happens to be popular in Guadalajara today is not what he grew up eating.
  // "Classic" decor alone is not enough: plenty of steakhouses have it.
  const localKitchens = raw.filter(local);
  const oldKitchens = raw.filter((e) => local(e) || heritage(e));
  const dishSource = localKitchens.length >= 3 ? localKitchens : oldKitchens.length >= 3 ? oldKitchens : raw;
  const tally = (types: string[], from = raw, rankTraditional = false) => {
    const m = new Map<string, number>();
    for (const e of from)
      for (const t of e.tags ?? []) {
        if (!types.includes(t.type ?? "")) continue;
        const name = String(t.name).trim();
        if (!name || GENERIC.has(name.toLowerCase()) || name.length > 34 || MODERN_PLACE.test(name)) continue;
        m.set(name, (m.get(name) ?? 0) + weight(e) + (rankTraditional && traditional(name) ? 6 : 0));
      }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  };
  const places: Entity[] = [...raw]
    .filter((e) => !MODERN_PLACE.test(e.name))
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 6)
    .map((e) => ({
      id: e.entity_id ?? e.name,
      name: e.name,
      kind: "place",
      image: e.properties?.image?.url,
      blurb: e.properties?.description?.slice(0, 200),
      popularity: e.popularity,
      tags: (e.tags ?? [])
        .filter((t) => DISH_TYPES.includes(t.type ?? "") || t.type === "urn:tag:cuisine:qloo")
        .slice(0, 8)
        .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name })),
    }));
  return {
    city,
    cuisines: tally(["urn:tag:cuisine:qloo"]).slice(0, 6),
    dishes: varied(tally(DISH_TYPES, dishSource, true), 12),
    landmarks: distinctPlaces(tally(["urn:tag:nearby_attraction:qloo"]), 8),
    places,
  };
}

const byScore = (by: number) => (a: Entity, b: Entity) =>
  (b.affinity ?? 0) + peakBoost(b.year, by) - ((a.affinity ?? 0) + peakBoost(a.year, by));

export const DOMAIN_LABEL: Record<Domain, string> = {
  music: "Songs",
  film: "Films",
  tv: "Television",
  stars: "Faces",
  books: "Books",
  home: "Taste of home",
};

export { domainOf };

/** Turn home taste into card-able items. */
export function homeEntities(home: HomeTaste | undefined): Entity[] {
  if (!home) return [];
  const town = home.city.split(",")[0];
  const out: Entity[] = [];
  home.dishes.slice(0, 4).forEach((d, i) => {
    const place = home.places.find((p) => p.tags?.some((t) => t.name === d));
    out.push({
      id: `home-dish-${i}`,
      name: d,
      kind: "place",
      image: place?.image,
      blurb: `A dish ${town} is known for${place ? `, served at ${place.name}` : ""}.`,
    });
  });
  home.landmarks.slice(0, 3).forEach((l, i) =>
    out.push({ id: `home-landmark-${i}`, name: l, kind: "place", blurb: `A landmark of ${town}.` }),
  );
  return out;
}

/**
 * The carer-facing reason for a card, built only from data so it cannot drift from the facts.
 * Year and age are shown as chips beside it, so they are left out here.
 */
export function whyOf(
  e: Entity,
  d: Domain,
  ctx: { known: Set<string>; guessed: Set<string>; names: Map<string, string>; pronoun?: string; town: string; together?: Set<string> },
): string {
  const pr = pronounOf(ctx.pronoun);
  if (d === "home") {
    return e.id.startsWith("home-dish")
      ? `A dish ${ctx.town} is known for, from local kitchens in Qloo's place data.`
      : `A ${ctx.town} landmark near the places Qloo lists.`;
  }
  const loves = `${pr.sub} ${pr.sub === "they" ? "love" : "loves"}`;
  // Common ground: Qloo found it from their side and ranked it near the family member's taste too.
  if (ctx.together?.has(e.id)) {
    return ctx.known.has(e.id)
      ? `You told us ${loves} this, and Qloo ranks it close to what you love too.`
      : `From ${pr.pos} years, and Qloo ranks it close to what you love too.`;
  }
  if (ctx.known.has(e.id)) return `You told us ${loves} this.`;
  // Only what the family told us counts as a love; era anchors are just famous names from the time.
  const via = (e.because ?? []).filter((id) => ctx.names.has(id));
  const loved = via.filter((id) => ctx.known.has(id)).slice(0, 2).map((id) => ctx.names.get(id));
  if (loved.length) return `Qloo's taste graph links it to ${pr.pos} love of ${loved.join(" and ")}.`;
  if (via.length) return `Qloo's taste graph links it to ${via.slice(0, 2).map((id) => ctx.names.get(id)).join(" and ")}, from the same years.`;
  if (ctx.guessed.has(e.id)) return `A big name where ${pr.sub} grew up, checked against Qloo.`;
  return `Close to ${pr.pos} taste in Qloo's graph, from ${pr.pos} years.`;
}

/** The slim view of an entity the LLM sees when writing cards. */
export function forPrompt(e: Entity, domain: Domain, by: number, known: Set<string>, names: Map<string, string>) {
  return {
    id: e.id,
    domain,
    name: e.name,
    year: e.year,
    career: e.careerFrom ? `${e.careerFrom}-${e.careerTo ?? "on"}` : undefined,
    age_then: ageAt(e.year, by),
    known_love: known.has(e.id) || undefined,
    because: e.because?.map((id) => names.get(id)).filter(Boolean).slice(0, 2),
    about: (e.knownFor ?? e.blurb)?.slice(0, 130),
    keywords: e.keywords?.slice(0, 4),
  };
}

export const PROMPT_RULES = (pr: ReturnType<typeof pronounOf>) => [
  `why: one short sentence for the caregiver about ${pr.obj}, using only facts present in the data: year, age_then, because (the favorites Qloo linked it to), known_love (something the caregiver told us). Never write field names. Never invent a habit or connection. Good: 'Out in 1965, when ${pr.sub} was 14. Qloo links it to ${pr.pos} love of Mohammed Rafi.' Bad: 'Kishore's songs matched ${pr.pos} cooking rhythm.'`,
  `prompt: the exact words the caregiver reads aloud TO ${pr.obj}. "You" means ${pr.obj}, the person living with dementia, never the caregiver. An open invitation, never a memory test: never 'Do you remember', never ask for names, dates or facts. Start from 'Tell me about', 'What was it like', 'How did it feel', 'I heard', or a sensory question. Under 22 words, plain words, one idea, only facts from the data or life notes. Good: 'People say Rafi's voice was like honey. How does it feel to hear him again?' Good: 'Tell me about the cinema halls when Guide came out. What was it like?' Good: 'What did torta ahogada taste like back then?' Bad: 'You can hum along to a song you both enjoy.' Bad: 'Do you remember who starred in Guide?' Bad: 'Tell me about the time you made tamales with your mother.' (never assume something happened to ${pr.obj} unless the life notes say so) Bad: 'Tell me about Pedro Infante's guitar at family parties.' (life notes describe ${pr.obj}; never move them onto an artist or film)`,
  "native: the same prompt in the heart language, in its native script, natural and grammatical, titles spelled as natives write them; empty string if no heart language.",
  `cue: a practical action for the caregiver under 10 words, e.g. 'Play the preview softly and watch ${pr.pos} hands.'`,
];

const QUIZ = /\b(?:do|did|can|could|would) you (?:still )?(?:remember|recall)\b/i;
// "Remember" in the languages the presets use most; a translated line that quizzes is dropped.
const NATIVE_QUIZ = /recuerd|acuerdas|याद है|याद हैं|याद आ|lembra|souviens|erinnerst/i;
// A word half in Devanagari and half in Latin letters ("गोलmaal") is a slip, not a translation.
const MIXED_SCRIPT = /[ऀ-ॿ][A-Za-z]|[A-Za-z][ऀ-ॿ]/;

/**
 * The model usually keeps to invitations, but a memory test slipping through is the one
 * mistake that can make someone feel they are failing. Turn it into an invitation, and drop
 * the translated line, which carries the same question.
 */
export function asInvitation(prompt: string, native: string | undefined, name: string): { prompt: string; native?: string } {
  if (!QUIZ.test(prompt)) return { prompt, native: native && !NATIVE_QUIZ.test(native) && !MIXED_SCRIPT.test(native) ? native : undefined };
  const rest = prompt.replace(/^.*?\b(?:do|did|can|could|would) you (?:still )?(?:remember|recall)\s+/i, "").replace(/[?.!\s]+$/, "");
  // "...remember cooking it with your family" can become an invitation; "...remember who sang it" cannot.
  const usable = rest && rest !== prompt && !QUIZ.test(rest) && !/^(?:who|what|when|where|which|whether|if|the name|how many)\b/i.test(rest);
  const fixed = usable ? `Tell me about ${rest}.` : `Tell me about ${name}. What was it like?`;
  return { prompt: fixed };
}

// A why line that leaks field names or guesses is replaced by the one built from data.
const GUESSY = /known.?love|age.?then|because|born \d{4}|could have|might have|likely|probably/i;

// Taste tags are shown to the family, so leave out the ones that read as a judgement.
const UNWELCOME_TAG = /atheis|conspira|controvers|desperat|relentless|nihilis|bleak|disturb|grim|violen|crime|drug|sex|death|war\b|cynic|misogyn|racis/i;

interface Curated {
  opening?: string;
  cards?: { id: string; name?: string; why?: string; prompt?: string; native?: string; cue?: string }[];
}

async function curate(
  p: BuildInput,
  w: Window,
  u: Understanding,
  pool: { e: Entity; d: Domain }[],
  known: Set<string>,
  names: Map<string, string>,
  both: Set<string>,
): Promise<Curated> {
  const pr = pronounOf(p.pronoun);
  return chatJSON<Curated>(
    [
      {
        role: "system",
        content:
          "You are Duet, a reminiscence therapy assistant that helps a family member share culture with a loved one living with dementia. " +
          "You plan a calm 20 to 30 minute session of 10 cards using ONLY the candidate items given (they come from Qloo's cultural taste graph). " +
          "You never invent facts, song titles, plot details or memories beyond the candidate data and the caregiver's life notes. Reply with JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          person: {
            born: p.birthYear,
            grew_up_in: u.place ?? p.hometown,
            pronoun: pr.sub,
            formative_years: `${w.from}-${w.to}`,
            heart_language: u.language ?? null,
            life_notes: u.life ?? [],
          },
          // Short ids: models copy "c12" reliably, 36-character UUIDs much less so.
          candidates: pool.map(({ e, d }, i) => ({ ...forPrompt(e, d, p.birthYear, known, names), id: `c${i}`, for_both: both.has(e.id) || undefined })),
          output: {
            opening: "One or two warm sentences to the caregiver about how to begin (setting, pace).",
            cards: "Exactly 10 objects {id, name, why, prompt, native, cue} in session order. id must be a candidate id and name that candidate's exact name.",
          },
          rules: [
            "Card 1 must be a known_love item if any exist. Start familiar, build gently, end on calm familiar music.",
            "Mix domains. Music roughly every second or third card. At most 2 home cards, at most 1 books card.",
            "Home cards: only traditional local dishes or old landmarks they could have known as a young person; skip modern, imported or steakhouse items.",
            ...(both.size
              ? [
                  `for_both items are from ${pr.pos} years and close to the family member's own taste too. Include 2 or 3, spread through the middle of the session. Their cue invites the caregiver to share it, e.g. 'Play it together and tell ${pr.obj} what you like about it.'`,
                ]
              : []),
            ...PROMPT_RULES(pr),
          ],
        }),
      },
    ],
    { temperature: 0.6, maxTokens: 5000 },
  );
}

// The why line for these comes from whyOf, like every other card.
function fallbackCards(pool: { e: Entity; d: Domain }[], known: Set<string>): NonNullable<Curated["cards"]> {
  const order: Domain[] = ["music", "film", "music", "stars", "tv", "music", "home", "film", "music", "film"];
  const used = new Set<string>();
  const out: NonNullable<Curated["cards"]> = [];
  const first = pool.find((x) => known.has(x.e.id));
  if (first) {
    used.add(first.e.id);
    out.push({ id: first.e.id, prompt: `Tell me about ${first.e.name}. What did it feel like back then?` });
  }
  for (const d of order) {
    if (out.length >= 10) break;
    const x = pool.find((y) => y.d === d && !used.has(y.e.id));
    if (!x) continue;
    used.add(x.e.id);
    out.push({ id: x.e.id, prompt: `What comes to mind when you see ${x.e.name}?` });
  }
  return out;
}

export async function buildMemoryMap(p: BuildInput, emit: Emit): Promise<MemoryMap> {
  const trace: TraceStep[] = [];
  const step = tracer(emit, trace);
  const by = p.birthYear;
  const w = bumpWindow(by);
  const pr = pronounOf(p.pronoun);
  const fy = yearsOf(p.family?.birthYear);

  // 1. Understand the caregiver's words.
  const u =
    (await step("understand", "Reading your notes", async () => {
      const r = await understand(p, w);
      const fav = r.favorites?.length ?? 0;
      return {
        value: r,
        detail: `Found ${fav} favorite${fav === 1 ? "" : "s"}${r.language ? `, heart language ${r.language}` : ""}; proposed ${r.anchors?.length ?? 0} era anchors to verify.`,
      };
    })) ?? ({} as Understanding);

  // The model sometimes files the family member's loves under theirs too. A name found only in
  // the family member's list is not theirs.
  const fromFamily = (name: string) => {
    const n = norm(name);
    return !!p.family?.loves && norm(p.family.loves).includes(n) && !norm(p.about).includes(n);
  };
  u.favorites = (u.favorites ?? []).filter((m) => !fromFamily(m.name));

  // Sparks from past sessions are favorites the family has now seen with their own eyes.
  if (p.sparks?.length) {
    const have = new Set((u.favorites ?? []).map((m) => norm(m.name)));
    u.favorites = [...(u.favorites ?? []), ...p.sparks.filter((s) => !have.has(norm(s.name)))].slice(0, 10);
  }

  // 2. Resolve favorites, and verify the LLM's anchors against Qloo (unverified ones are dropped).
  // The family member's own loves are found the same way, in their own years.
  const loves = p.family?.loves?.trim();
  // The model finds the names; Qloo's popularity settles the kind, since "Coco" is far better
  // known as the film than as the singer.
  const theirMentions = loves
    ? (u.family_favorites?.length ? u.family_favorites : splitLoves(loves)).map((m) => ({ ...m, kind: "any" }))
    : [];
  const resolved = await step("resolve", "Finding them in Qloo's taste graph", async () => {
    const [fav, anc, fam] = await Promise.all([
      resolveAll(u.favorites ?? [], w, false),
      resolveAll(u.anchors ?? [], w, true),
      resolveAll(theirMentions, fy, false),
    ]);
    const favIds = new Set(fav.found.map((e) => e.id));
    const guessed = anc.found.filter((e) => !favIds.has(e.id) && !isHeavy(e));
    // Your loves seed the shared part of the session, so the gentle screen applies to them too.
    const setAside = fam.found.filter(isHeavy);
    return {
      value: { seeds: fav.found, guessed, yours: fam.found.filter((e) => !isHeavy(e)) },
      detail:
        `${fav.found.length} favorites matched. ${guessed.length} of ${u.anchors?.length ?? 0} era anchors verified${anc.missed.length ? `; dropped ${anc.missed.join(", ")}` : ""}.` +
        (theirMentions.length ? ` ${fam.found.length} of your ${theirMentions.length} loves found` : "") +
        (setAside.length ? `; set aside ${setAside.map((e) => `${e.name} (${heavyTheme(e)})`).join(", ")} as too heavy for a session.` : theirMentions.length ? "." : ""),
      request: "GET /search?query=…&types=urn:entity:…",
      warn: fav.found.length + guessed.length === 0,
    };
  });
  const seeds = resolved?.seeds ?? [];
  const guessed = resolved?.guessed ?? [];
  const yours = resolved?.yours ?? [];
  emit({ type: "seeds", seeds, guessed });

  const starts = [...seeds, ...guessed];
  const seedIds = starts.map((e) => e.id);
  const startIds = new Set(seedIds);
  const known = new Set(seeds.map((e) => e.id));
  const names = new Map(starts.map((e) => [e.id, e.name]));
  const domains: Partial<Record<Domain, Entity[]>> = {};
  const signal = seedIds.length ? seedIds : undefined;
  const ageSignal = new Date().getFullYear() - by >= 55 ? "55_and_older" : undefined;
  const screened = new Map<string, string>();
  const avoid = new Set(p.avoidIds ?? []);
  const keep = (list: Entity[]) =>
    list.filter((e) => {
      if (startIds.has(e.id) || avoid.has(e.id)) return false;
      const theme = heavyTheme(e);
      if (theme) screened.set(e.name, theme);
      return !theme;
    });

  const domainTask = (d: Domain, label: string, fn: () => Promise<{ r: QlooResult<Entity[]>; items: Entity[] }>) =>
    step(`domain-${d}`, label, async () => {
      const { r, items } = await fn();
      domains[d] = items;
      emit({ type: "domain", domain: d, items });
      return { value: items, detail: `${items.length} kept of ${r.data.length} from Qloo`, request: r.request, warn: items.length === 0 };
    });

  const common = { seeds: signal, age: signal ? undefined : ageSignal, explain: !!signal };
  // Their own country's films, kept apart from the wider picks that top up the shelf.
  let homeFilms: Entity[] = [];

  // 3. Era-locked recall across domains, in parallel. With a family member's loves to go on,
  // their own years get a shelf too.
  const [, , , , , home, profile, yourPools] = await Promise.all([
    domainTask("music", `Songs ${w.from}–${w.to}`, async () => {
      const r = await insights({
        ...common,
        kind: "artist",
        // Decade tags only help when there is little else to go on; with real seeds they dilute.
        signalTags: signal && signal.length >= 2 ? undefined : decadeTags(w),
        take: 50,
      });
      const items = keep(r.data)
        .filter((e) => artistInEra(e, by, w) && !starts.some((s) => sameName(s.name, e.name)))
        .slice(0, 12);
      return { r, items };
    }),
    domainTask("film", `Films ${w.from}–${w.to}`, async () => {
      const years = { "filter.release_year.min": w.from - 1, "filter.release_year.max": w.to };
      // Home-country cinema first, then whatever else the taste graph links in.
      const [local, any] = await Promise.all([
        u.country
          ? insights({ ...common, kind: "movie", filter: { ...years, "filter.release_country": u.country }, take: 20 })
          : Promise.resolve(undefined),
        insights({ ...common, kind: "movie", filter: years, take: 30 }),
      ]);
      const localItems = keep(local?.data ?? []).sort(byScore(by));
      homeFilms = localItems.slice(0, 9);
      const ids = new Set(localItems.map((e) => e.id));
      const rest = keep(any.data).filter((e) => !ids.has(e.id)).sort(byScore(by));
      const items = [...localItems.slice(0, 9), ...rest].slice(0, 12);
      return { r: local && localItems.length ? local : any, items };
    }),
    domainTask("tv", `Television ${w.from}–${w.to}`, async () => {
      // Television was local. A girl in 1960s Lucknow never saw The Green Hornet.
      const r = await insights({
        ...common,
        kind: "tv_show",
        filter: {
          "filter.release_year.min": w.from - 3,
          "filter.release_year.max": w.to,
          "filter.release_country": u.country,
        },
        take: 12,
      });
      return { r, items: keep(r.data).sort(byScore(by)).slice(0, 6) };
    }),
    domainTask("stars", "Faces of the era", async () => {
      const r = await insights({
        ...common,
        kind: "person",
        filter: { "filter.date_of_birth.min": `${by - 40}-01-01`, "filter.date_of_birth.max": `${by + 2}-12-31` },
        take: 20,
      });
      const items = keep(r.data)
        .filter((e) => !starts.some((s) => sameName(s.name, e.name)) && !(domains.music ?? []).some((m) => sameName(m.name, e.name)))
        .slice(0, 8);
      return { r, items };
    }),
    // Qloo's books lean English-language; for someone whose heart language is elsewhere they
    // only earn a shelf when the notes say reading mattered.
    !u.language || u.reader
      ? domainTask("books", `Books ${w.from - 5}–${w.to}`, async () => {
          const r = await insights({
            ...common,
            kind: "book",
            filter: { "filter.publication_year.min": w.from - 5, "filter.publication_year.max": w.to },
            take: 10,
          });
          return { r, items: keep(r.data).slice(0, 5) };
        })
      : Promise.resolve(undefined),
    step("home", `Taste of ${p.hometown.split(",")[0]}`, async () => {
      const r = await placesNear(p.hometown, 30);
      const h = aggregateHome(r.data, u.place ?? p.hometown, u.local_cuisines ?? [], u.local_dishes ?? []);
      emit({ type: "home", home: h });
      return {
        value: h,
        detail: `${h.dishes.length} dishes, ${h.cuisines.length} cuisines, ${h.landmarks.length} landmarks from ${r.data.length} local places`,
        request: r.request,
        warn: !h.dishes.length,
      };
    }),
    signal
      ? step("profile", "Reading the shape of their taste", async () => {
          const r = await tasteProfile(seedIds, 20);
          const tags = r.data.filter((t) => !UNWELCOME_TAG.test(t.name)).slice(0, 12);
          emit({ type: "profile", tags });
          return { value: tags, detail: tags.slice(0, 6).map((t) => t.name).join(", "), request: r.request };
        })
      : Promise.resolve<Tag[] | undefined>(undefined),
    yours.length
      ? step("yours", `Your years, ${fy.from}–${fy.to}`, async () => {
          const r = await yourShelf({
            yours: yours.map((e) => e.id),
            elderBorn: by,
            years: fy,
            country: u.country,
            skip: (e) => yours.some((y) => y.id === e.id) || startIds.has(e.id) || avoid.has(e.id),
          });
          return {
            value: r,
            detail: `${r.music.length} artists and ${r.film.length} films from your taste`,
            request: r.requests[0],
            warn: !r.music.length && !r.film.length,
          };
        })
      : Promise.resolve(undefined),
  ]);

  const held = [...screened.entries()];
  trace.push({
    id: "gentle",
    label: "Gentle content screen",
    status: "ok",
    ms: 0,
    detail: held.length
      ? `Held back ${held.length}: ${held.slice(0, 5).map(([n, t]) => `${n} (${t})`).join(", ")}${held.length > 5 ? "…" : ""}`
      : "Nothing needed holding back",
  });
  emit({ type: "step", step: trace.at(-1)! });

  // 4. Common ground: Qloo ranks their era by the family member's taste, and the other way round.
  const together = yours.length
    ? await step("together", "Finding your common ground", async () => {
        // Common ground from their years means cinema they could have seen at home.
        const shelves = { ...domains, film: homeFilms.length >= 4 ? homeFilms : domains.film };
        const r = await findTogether({ yours, hers: seeds, starts, shelves, yourShelf: yourPools ?? { film: [], music: [] }, years: fy });
        const t = r.together;
        emit({ type: "together", together: t });
        const top = t.then[0];
        const love = t.then.find((x) => x.loved);
        const link = t.pairs.find((x) => x.influenced);
        return {
          value: t,
          detail:
            (top ? `Ranked by your taste, ${top.entity.name} comes out closest of ${pr.pos} years` : "Nothing from those years to rank yet") +
            (love && love !== top ? `, with ${love.entity.name}, one of ${pr.pos} own loves, near the top` : "") +
            "." +
            (link ? ` Qloo lists ${link.hers.name} among ${link.yours.name}'s influences.` : ""),
          request: r.requests[0],
          warn: !t.then.length,
        };
      })
    : undefined;
  // The few that sit nearest both tastes become shared moments in the session, at most three of them.
  const both = new Set((together?.then ?? []).slice(0, 4).map((x) => x.entity.id));
  const MAX_BOTH = 3;

  // 5. Curate the first session.
  const pool: { e: Entity; d: Domain }[] = [
    ...starts.map((e) => ({ e, d: domainOf(e) })),
    ...(["music", "film", "tv", "stars"] as Domain[]).flatMap((d) =>
      (domains[d] ?? []).slice(0, d === "music" || d === "film" ? 10 : 5).map((e) => ({ e, d })),
    ),
    ...(u.reader ? (domains.books ?? []).slice(0, 3).map((e) => ({ e, d: "books" as Domain })) : []),
    ...homeEntities(home).map((e) => ({ e, d: "home" as Domain })),
  ];
  for (const x of together?.then ?? []) if (both.has(x.entity.id) && !pool.some((y) => y.e.id === x.entity.id)) pool.push({ e: x.entity, d: x.domain });
  const byId = new Map(pool.map((x) => [x.e.id, x]));
  // The session is mostly music and film; food and books are a seasoning, whatever the model picks.
  const CAP: Partial<Record<Domain, number>> = { home: 2, books: 1 };
  const capped = () => {
    const n = new Map<Domain, number>();
    return (c: { id: string }) => {
      const d = byId.get(c.id)?.d;
      if (!d) return false;
      n.set(d, (n.get(d) ?? 0) + 1);
      return n.get(d)! <= (CAP[d] ?? Infinity);
    };
  };

  const curated = await step("curate", "Writing tonight's session", async () => {
    const c = await curate(p, w, u, pool, known, names, both);
    const byName = new Map(pool.map((x) => [norm(x.e.name), x]));
    const valid = (c.cards ?? [])
      .map((x) => {
        // The words were written about the named item, so the name wins when it and the id disagree.
        const named = x.name ? byName.get(norm(x.name)) : undefined;
        if (named) return { ...x, id: named.e.id };
        const i = Number(String(x.id).replace(/^c/i, ""));
        const hit = Number.isInteger(i) ? pool[i] : undefined;
        return hit ? { ...x, id: hit.e.id } : byId.has(x.id) ? x : undefined;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .filter(capped());
    return { value: { ...c, cards: valid }, detail: `${valid.length} cards, written as invitations, never memory tests` };
  });
  const cardsIn = [...(curated?.cards ?? [])];
  // Never ship a thin session: top up from the deterministic planner.
  if (cardsIn.length < 8) {
    const have = new Set(cardsIn.map((c) => c.id));
    cardsIn.push(...fallbackCards(pool, known).filter((c) => !have.has(c.id)).slice(0, 10 - cardsIn.length));
  }

  const used = new Set<string>();
  const session: Card[] = [];
  const whyCtx = {
    known,
    guessed: new Set(guessed.map((e) => e.id)),
    names,
    pronoun: p.pronoun,
    town: (u.place ?? p.hometown).split(",")[0],
  };
  // The model's line about a known love is kept only if it sticks to that item and its own year.
  const trustworthy = (why: string, e: Entity) =>
    !GUESSY.test(why) &&
    ![...names.values()].some((n) => n !== e.name && why.toLowerCase().includes(n.toLowerCase())) &&
    // A decade counts as a year here: "out in the 1950s" about a singer is a guess.
    (why.match(/\b(?:19|20)\d\ds?\b/g) ?? []).every((y) => Number(y) === e.year);
  const fits = capped(); // again, since the top-up may have added more of a capped kind
  for (const c of cardsIn) {
    const x = byId.get(c.id);
    if (!x || used.has(c.id) || !fits(c)) continue;
    used.add(c.id);
    const said = asInvitation(c.prompt ?? `What comes to mind when you see ${x.e.name}?`, c.native, x.e.name);
    const shared = both.has(x.e.id) && session.filter((s) => s.together).length < MAX_BOTH;
    session.push({
      key: `${c.id}-${session.length}`,
      domain: x.d,
      entity: x.e,
      ageThen: ageAt(x.e.year, by),
      // The model may draw on the family's notes for something they told us; everything else is from data.
      why: known.has(x.e.id) && !shared && c.why && trustworthy(c.why, x.e) ? c.why : whyOf(x.e, x.d, { ...whyCtx, together: shared ? both : undefined }),
      prompt: said.prompt,
      promptNative: said.native,
      cue: c.cue,
      together: shared || undefined,
    });
  }
  // A session for two should hold at least one moment that belongs to both.
  if (both.size && !session.some((c) => c.together)) {
    const x = (together?.then ?? []).map((t) => byId.get(t.entity.id)).find((y) => y && !used.has(y.e.id) && y.d !== "home");
    if (x) {
      session.splice(Math.min(3, session.length), 0, {
        key: `${x.e.id}-both`,
        domain: x.d,
        entity: x.e,
        ageThen: ageAt(x.e.year, by),
        why: whyOf(x.e, x.d, { ...whyCtx, together: both }),
        prompt: `Tell me about ${x.e.name}. What was it like back then?`,
        cue: `Enjoy it together and tell ${pr.obj} what you like about it.`,
        together: true,
      });
    }
  }

  const map: MemoryMap = {
    personId: p.id,
    window: w,
    seeds,
    guessed,
    profile: profile ?? [],
    domains,
    home: home ?? undefined,
    place: u.place,
    language: u.language ?? p.language ?? undefined,
    life: u.life ?? [],
    opening: curated?.opening,
    together,
    session,
    trace,
    builtAt: Date.now(),
  };
  emit({ type: "done", map });
  return map;
}

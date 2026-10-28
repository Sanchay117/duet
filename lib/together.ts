// The other half of the duet. The family member names a few things they love, and Qloo works
// across the generations in both directions: their era is ranked by the family member's taste,
// the family member's era by theirs, and each of the family member's favourites is paired with
// the nearest of theirs.
import { domainOf } from "./domain";
import { bumpWindow, heavyTheme, heavyWord, sameName } from "./era";
import { insights, rankFor } from "./qloo";
import type { Domain, Entity, EntityKind, Pair, SharedItem, Together, Window } from "./types";

const KIND_OF: Partial<Record<Domain, EntityKind>> = { music: "artist", film: "movie", tv: "tv_show" };

/** The family member's own formative years, or the last fifteen when we don't know their age. */
export function yearsOf(birthYear: number | undefined, now = new Date().getFullYear()): Window {
  if (!birthYear) return { from: now - 15, to: now };
  const w = bumpWindow(birthYear, now);
  return { from: Math.min(w.from, now - 8), to: w.to };
}

/**
 * The family member's own shelf: films from their years and artists of their generation, found
 * from their favourites. Qloo's graph rarely jumps fifty years from an elder's taste on its own,
 * so this side starts from the younger taste and is ranked by the elder's afterwards.
 */
export async function yourShelf(o: { yours: string[]; elderBorn: number; years: Window; country?: string; skip: (e: Entity) => boolean }) {
  const y = o.years;
  const span = { "filter.release_year.min": y.from, "filter.release_year.max": y.to };
  // A generation younger than the elder, and still making music in the family member's years.
  const young = (e: Entity) =>
    (e.careerTo ?? 9999) >= y.from &&
    (e.born !== undefined ? e.born >= o.elderBorn + 25 : e.careerFrom !== undefined && e.careerFrom >= y.from - 15);
  const clean = (list: Entity[]) => list.filter((e) => !heavyTheme(e) && !o.skip(e));

  const [local, artists] = await Promise.all([
    insights({ kind: "movie", seeds: o.yours, filter: { ...span, "filter.release_country": o.country }, take: 15 }),
    insights({ kind: "artist", seeds: o.yours, take: 30 }),
  ]);
  const requests = [artists.request, local.request];
  let film = clean(local.data);
  // Home-country cinema can run thin; then take the taste graph's wider picks from those years.
  if (film.length < 4 && o.country) {
    const any = await insights({ kind: "movie", seeds: o.yours, filter: span, take: 15 });
    requests.push(any.request);
    const have = new Set(film.map((e) => e.id));
    film = [...film, ...clean(any.data).filter((e) => !have.has(e.id))];
  }
  return { film: film.slice(0, 12), music: clean(artists.data).filter(young).slice(0, 12), requests };
}

// Which kinds of Qloo tag say something two people could talk about. Audience and style tags
// ("Loyal", "Polished") describe nearly everything, so they never count.
const TAG_WEIGHT: [RegExp, number][] = [
  [/^urn:tag:theme:/, 3],
  [/^urn:tag:(?:sub)?genre:/, 2.5],
  [/^urn:tag:influence:/, 2],
  [/^urn:tag:keyword:/, 2],
  [/^urn:tag:(?:music|instrument):/, 1.5],
  [/^urn:tag:(?:plot|interests):/, 1],
];
const weightOf = (id: string) => TAG_WEIGHT.find(([re]) => re.test(id))?.[1] ?? 0;
const TOO_PLAIN = /^(?:all|love|drama|comedy|vocals|music|film|movie|pop|classic|emotional)$/i;
// A pair is a warm conversation starter, so it is not introduced by what hurts.
const SORE = /heartbreak|longing|loss|sad|lonel|grief|tragic|melanchol|regret|pain|betray/i;

/** The tags two favourites share, most telling first: of a kind worth saying, and rare across everything both sides turned up. */
function sharedTags(a: Entity, b: Entity, df: Map<string, number>, n: number): string[] {
  const theirs = new Set((b.tags ?? []).map((t) => t.id));
  const best = new Map<string, { name: string; s: number }>();
  for (const t of a.tags ?? []) {
    if (!theirs.has(t.id) || TOO_PLAIN.test(t.name) || SORE.test(t.name) || heavyWord(t.name) || t.name.length > 20) continue;
    const s = weightOf(t.id) * (1 + 0.5 * Math.log(n / (df.get(t.id) ?? 1)));
    const k = t.name.toLowerCase();
    if (s > 0 && s > (best.get(k)?.s ?? 0)) best.set(k, { name: t.name, s });
  }
  return [...best.values()]
    .sort((x, y) => y.s - x.s)
    .slice(0, 3)
    .map((x) => x.name);
}

/** Qloo's "influenced by" tags, e.g. Arijit Singh carries one for Mohammed Rafi. */
const influencesOf = (e: Entity) => (e.tags ?? []).filter((t) => t.id.startsWith("urn:tag:influenced_by:")).map((t) => t.name);

/** Round-robin across domains, so the list opens with the best song, the best film, the best show. */
function interleave(lists: SharedItem[][], max: number): SharedItem[] {
  const out: SharedItem[] = [];
  for (let i = 0; out.length < max && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < max) out.push(l[i]);
  return out;
}

export async function findTogether(o: {
  yours: Entity[];
  /** Their own loves, as the family told us. */
  hers: Entity[];
  /** Their loves plus the era anchors the agent verified. */
  starts: Entity[];
  shelves: Partial<Record<Domain, Entity[]>>;
  yourShelf: { film: Entity[]; music: Entity[] };
  years: Window;
}): Promise<{ together: Together; requests: string[] }> {
  const yourIds = o.yours.map((e) => e.id);
  const herIds = (o.hers.length ? o.hers : o.starts).map((e) => e.id);
  const herLoves = new Set(o.hers.map((e) => e.id));
  const requests: string[] = [];

  // Qloo ranks a list by one side's taste; anything it leaves out keeps its place at the back.
  const rank = async (d: Domain, list: Entity[], by: string[]) => {
    const kind = KIND_OF[d];
    if (!kind || list.length < 2) return list.map((e) => ({ e, affinity: undefined as number | undefined }));
    const r = await rankFor(kind, by, list.map((e) => e.id));
    requests.push(r.request);
    const aff = new Map(r.data.map((x) => [x.id, x.affinity]));
    return list
      .map((e, i) => ({ e, affinity: aff.get(e.id), i }))
      .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1) || a.i - b.i);
  };
  const unique = (list: Entity[]) => {
    const seen = new Set<string>();
    return list.filter((e) => !seen.has(e.id) && !!seen.add(e.id));
  };
  const theirsIn = (d: Domain) => unique([...o.starts.filter((e) => domainOf(e) === d), ...(o.shelves[d] ?? [])]).slice(0, 15);
  const yoursIn = (d: Domain) =>
    unique([...o.yours.filter((e) => domainOf(e) === d), ...(d === "music" ? o.yourShelf.music : d === "film" ? o.yourShelf.film : [])]).slice(0, 15);
  const isYours = (e: Entity) => yourIds.includes(e.id) || o.yours.some((y) => y.kind === e.kind && sameName(y.name, e.name));

  const thenDomains: Domain[] = ["music", "film", "tv"];
  const nowDomains: Domain[] = ["music", "film"];
  // Each of your favourites against the same kind of thing from their side, their own loves included.
  const pairable = o.yours.filter((y) => KIND_OF[domainOf(y)]).slice(0, 4);

  const [thenRanked, nowRanked, pairRanked] = await Promise.all([
    Promise.all(thenDomains.map(async (d) => (await rank(d, theirsIn(d), yourIds)).slice(0, 4))),
    Promise.all(nowDomains.map(async (d) => (await rank(d, yoursIn(d), herIds)).slice(0, 4))),
    Promise.all(pairable.map((y) => rank(domainOf(y), theirsIn(domainOf(y)).slice(0, 10), [y.id]))),
  ]);

  const then = interleave(
    thenRanked.map((l, i) => l.map((x) => ({ entity: x.e, domain: thenDomains[i], affinity: x.affinity, loved: herLoves.has(x.e.id) || undefined }))),
    8,
  );
  const now = interleave(
    nowRanked.map((l, i) => l.map((x) => ({ entity: x.e, domain: nowDomains[i], affinity: x.affinity, loved: isYours(x.e) || undefined }))),
    8,
  );

  // Tag rarity across everything both sides turned up.
  const corpus = unique([...o.yours, ...o.starts, ...Object.values(o.shelves).flat(), ...o.yourShelf.film, ...o.yourShelf.music]);
  const df = new Map<string, number>();
  for (const e of corpus) for (const id of new Set((e.tags ?? []).map((t) => t.id))) df.set(id, (df.get(id) ?? 0) + 1);

  const used = new Set<string>();
  const pairs: Pair[] = [];
  pairable.forEach((y, i) => {
    const ranked = pairRanked[i].map((x) => x.e).filter((e) => !used.has(e.id));
    // Qloo naming one of theirs among your favourite's influences is the strongest link there is;
    // then one of their own loves near the top; then simply the closest.
    const influence = influencesOf(y);
    const isInfluence = (e: Entity) => influence.some((n) => sameName(n, e.name));
    const hers =
      ranked.find((e) => isInfluence(e) && herLoves.has(e.id)) ??
      ranked.find(isInfluence) ??
      ranked.slice(0, 4).find((e) => herLoves.has(e.id)) ??
      ranked[0];
    if (!hers) return;
    used.add(hers.id);
    const influenced = isInfluence(hers);
    pairs.push({ yours: y, hers, tags: sharedTags(y, hers, df, corpus.length), influenced: influenced || undefined });
  });

  return { together: { yours: o.yours, then, now, pairs, years: o.years }, requests };
}

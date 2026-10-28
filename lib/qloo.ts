// Server-side Qloo client. The key never leaves the server.
import { heavyWord } from "./era";
import type { Entity, EntityKind, Tag } from "./types";

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const WEEK = 60 * 60 * 24 * 7;

type Params = Record<string, string | number | boolean | undefined | null>;

export class QlooError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface QlooResult<T> {
  data: T;
  ms: number;
  /** Human-readable request summary for the provenance trace. */
  request: string;
}

// Dedupe identical in-flight requests and keep a warm copy per server instance.
const memo = new Map<string, Promise<RawResponse>>();

function buildQuery(params: Params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

/** The parts of Qloo's response shape that Duet reads. */
export interface RawTag {
  id?: string;
  tag_id?: string;
  name: string;
  type?: string;
}

export interface RawEntity {
  entity_id?: string;
  id?: string;
  name: string;
  type?: string;
  subtype?: string;
  types?: string[];
  popularity?: number;
  tags?: RawTag[];
  external?: { spotify?: { id: string } | { id: string }[] };
  query?: { affinity?: number; explainability?: Record<string, { entity_id: string; score: number }[]> };
  properties?: {
    release_year?: number | string;
    publication_year?: number | string;
    release_date?: string;
    date_of_birth?: string;
    start_year?: number;
    end_year?: number;
    image?: { url?: string };
    short_description?: string;
    description?: string;
    short_descriptions?: { value: string }[];
    known_for?: string;
    keywords?: (string | { name: string })[];
    genres?: string[];
    external?: { spotify?: { id: string } };
  };
}

interface RawResponse {
  results?: RawEntity[] | { entities?: RawEntity[]; tags?: RawTag[] };
}

function entitiesOf(json: RawResponse): RawEntity[] {
  const r = json.results;
  return Array.isArray(r) ? r : (r?.entities ?? []);
}

async function call(path: string, params: Params): Promise<{ json: RawResponse; ms: number; request: string }> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new QlooError(500, "QLOO_API_KEY is not set");
  const qs = buildQuery(params);
  const url = `${BASE}${path}?${qs}`;
  const request = `GET ${path}?${decodeURIComponent(qs)}`;

  if (!memo.has(url)) {
    const p = (async () => {
      let last: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { "X-Api-Key": key, accept: "application/json" },
            cache: "force-cache",
            next: { revalidate: WEEK },
            signal: AbortSignal.timeout(20_000),
          });
          if (res.status === 429 || res.status >= 500) {
            last = new QlooError(res.status, `Qloo ${res.status}`);
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            continue;
          }
          if (!res.ok) throw new QlooError(res.status, `Qloo ${res.status}: ${(await res.text()).slice(0, 200)}`);
          return (await res.json()) as RawResponse;
        } catch (e) {
          if (e instanceof QlooError && e.status < 500 && e.status !== 429) throw e;
          last = e;
        }
      }
      throw last;
    })();
    memo.set(url, p);
    p.catch(() => memo.delete(url));
    if (memo.size > 2000) memo.delete(memo.keys().next().value as string);
  }

  const t0 = Date.now();
  const json = (await memo.get(url)) ?? {};
  return { json, ms: Date.now() - t0, request };
}

const urn = (kind: EntityKind) => `urn:entity:${kind}`;

function kindOf(raw: RawEntity): EntityKind {
  const t: string = raw.subtype ?? raw.types?.[0] ?? raw.type ?? "";
  return t.replace("urn:entity:", "") as EntityKind;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseInt(v.slice(0, 4), 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function spotifyId(raw: RawEntity): string | undefined {
  const ext = raw.external?.spotify ?? raw.properties?.external?.spotify;
  if (!ext) return undefined;
  if (Array.isArray(ext)) return ext[0]?.id;
  return ext.id;
}

// Forty tags is plenty when they are the telling ones. Qloo's own order often opens with plot
// keywords ("bikini", "traffic jam"), so screened themes come first, then genre and theme,
// and the long tail last.
const TAG_ORDER = [/:genre:/, /:subgenre:/, /:theme:/, /:influenced_by:/, /:influence:/, /:music:/, /:instrument:/, /:plot:/, /:keyword:qloo:/];
function tagRank(t: Tag) {
  if (heavyWord(t.name)) return -1;
  const i = TAG_ORDER.findIndex((re) => re.test(t.id));
  return i < 0 ? TAG_ORDER.length : i;
}

/** Normalize a raw Qloo entity into the slim shape the app uses. */
export function normalize(raw: RawEntity): Entity {
  const p = raw.properties ?? {};
  const keywords: string[] = (p.keywords ?? [])
    .map((k) => (typeof k === "string" ? k : k?.name))
    .filter(Boolean)
    .slice(0, 14);
  const tags: Tag[] = (raw.tags ?? [])
    .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name }))
    .filter((t) => t.id && t.name)
    .map((t, i) => ({ t, i, r: tagRank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, 40)
    .map((x) => x.t);
  const explain = raw.query?.explainability?.["signal.interests.entities"];
  const because = Array.isArray(explain)
    ? explain
        .filter((x) => (x.score ?? 0) >= 0.25)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.entity_id)
    : undefined;
  const blurb: string | undefined = p.short_description ?? p.description ?? p.short_descriptions?.[0]?.value;

  return {
    id: raw.entity_id ?? raw.id ?? "",
    name: raw.name,
    kind: kindOf(raw),
    year: num(p.release_year) ?? num(p.publication_year) ?? num(p.release_date),
    born: num(p.date_of_birth),
    careerFrom: num(p.start_year),
    careerTo: num(p.end_year),
    image: p.image?.url,
    spotify: spotifyId(raw),
    blurb: blurb ? blurb.slice(0, 320) : undefined,
    knownFor: p.known_for?.slice(0, 200),
    keywords: keywords.length ? keywords : undefined,
    tags: tags.length ? tags : undefined,
    genres: p.genres?.slice(0, 4),
    affinity: raw.query?.affinity,
    popularity: raw.popularity,
    because: because?.length ? because : undefined,
  };
}

/** Resolve a name to Qloo entities. */
export async function search(query: string, kinds: EntityKind[], take = 5): Promise<QlooResult<Entity[]>> {
  const { json, ms, request } = await call("/search", {
    query,
    types: kinds.map(urn).join(","),
    take,
  });
  return { data: entitiesOf(json).map(normalize), ms, request };
}

export interface InsightsOptions {
  kind: EntityKind;
  seeds?: string[];
  signalTags?: string[];
  excludeIds?: string[];
  excludeTags?: string[];
  filter?: Params;
  age?: string;
  take?: number;
  explain?: boolean;
}

/** Taste-graph recommendations for one entity type. */
export async function insights(o: InsightsOptions): Promise<QlooResult<Entity[]>> {
  const { json, ms, request } = await call("/v2/insights", {
    "filter.type": urn(o.kind),
    "signal.interests.entities": o.seeds?.slice(0, 20).join(","),
    "signal.interests.tags": o.signalTags?.join(","),
    "filter.exclude.entities": o.excludeIds?.slice(0, 60).join(","),
    "filter.exclude.tags": o.excludeTags?.join(","),
    "signal.demographics.age": o.age,
    "feature.explainability": o.explain ? true : undefined,
    take: o.take ?? 20,
    ...o.filter,
  });
  return { data: entitiesOf(json).map(normalize), ms, request };
}

/**
 * Qloo's affinity between one taste and a fixed list of entities, best first. This is how one
 * generation's shelf gets ranked by the other's taste. Entities Qloo leaves out are not returned.
 */
export async function rankFor(kind: EntityKind, seeds: string[], ids: string[]): Promise<QlooResult<{ id: string; affinity: number }[]>> {
  const list = ids.slice(0, 50);
  const { json, ms, request } = await call("/v2/insights", {
    "filter.type": urn(kind),
    "signal.interests.entities": seeds.slice(0, 20).join(","),
    "filter.results.entities": list.join(","),
    take: list.length,
  });
  return {
    data: entitiesOf(json).map((e) => ({ id: e.entity_id ?? e.id ?? "", affinity: e.query?.affinity ?? 0 })),
    ms,
    request,
  };
}

/** The tags that jointly characterize a set of entities: a taste profile. */
export async function tasteProfile(seeds: string[], take = 12): Promise<QlooResult<Tag[]>> {
  const { json, ms, request } = await call("/v2/insights", {
    "filter.type": "urn:tag",
    "signal.interests.entities": seeds.slice(0, 20).join(","),
    // Without this, place and payment tags ("Diners Club") leak into a music and film profile.
    "filter.parents.types": "urn:entity:artist,urn:entity:movie",
    take,
  });
  const raw = Array.isArray(json.results) ? [] : (json.results?.tags ?? []);
  const tags: Tag[] = raw.map((t) => ({ id: t.tag_id ?? t.id ?? "", name: t.name }));
  return { data: tags, ms, request };
}

/** Restaurants and their tags around a hometown. Raw tags are kept for aggregation. */
export async function placesNear(city: string, take = 30) {
  const { json, ms, request } = await call("/v2/insights", {
    "filter.type": "urn:entity:place",
    "filter.location.query": city,
    "filter.tags": "urn:tag:genre:place:restaurant",
    take,
  });
  return { data: entitiesOf(json), ms, request };
}

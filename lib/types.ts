export type EntityKind = "artist" | "movie" | "tv_show" | "person" | "book" | "place";

export type Domain = "music" | "film" | "tv" | "stars" | "books" | "home";

export interface Tag {
  id: string;
  name: string;
}

/** A Qloo entity, normalized to the handful of fields Duet uses. */
export interface Entity {
  id: string;
  name: string;
  kind: EntityKind;
  year?: number;
  born?: number;
  careerFrom?: number;
  careerTo?: number;
  image?: string;
  spotify?: string;
  blurb?: string;
  knownFor?: string;
  keywords?: string[];
  tags?: Tag[];
  genres?: string[];
  affinity?: number;
  popularity?: number;
  /** Seed entity ids that Qloo explainability says drove this result. */
  because?: string[];
}

export interface Window {
  from: number;
  to: number;
}

export interface Person {
  id: string;
  /** Display name. Stays in the browser and is never sent to Qloo. */
  name: string;
  birthYear: number;
  hometown: string;
  about: string;
  language?: string;
  pronoun?: "she" | "he" | "they";
  /** The other half of the duet: what the family member loves. */
  family?: Family;
  createdAt: number;
}

export interface Family {
  /** Free text: a few singers, films or shows they love. */
  loves: string;
  birthYear?: number;
}

export interface Card {
  key: string;
  domain: Domain;
  entity: Entity;
  ageThen?: number;
  why: string;
  prompt: string;
  promptNative?: string;
  /** Short sensory cue for the caregiver: what to do while the card is up. */
  cue?: string;
  /** Set when the card was added mid-session by the adaptive loop. */
  adaptedFrom?: string;
  /** Common ground: Qloo puts it near the family member's taste too. */
  together?: boolean;
}

/** An item one generation's taste found and the other's ranks highly. */
export interface SharedItem {
  entity: Entity;
  domain: Domain;
  /** Qloo's affinity for it from the family member's taste. */
  affinity?: number;
  /** Someone already named it: one of their loves on their side, one of yours on yours. */
  loved?: boolean;
}

/** One of the family member's favourites beside the nearest of theirs, with the Qloo tags they share. */
export interface Pair {
  yours: Entity;
  hers: Entity;
  tags: string[];
  /** Qloo lists theirs among your favourite's influences. */
  influenced?: boolean;
}

export interface Together {
  /** The family member's favourites, found in Qloo. */
  yours: Entity[];
  /** From their years, ranked by your taste. */
  then: SharedItem[];
  /** From your years, ranked by their taste. */
  now: SharedItem[];
  pairs: Pair[];
  /** The family member's own formative years. */
  years: Window;
}

export interface TraceStep {
  id: string;
  label: string;
  detail?: string;
  status: "run" | "ok" | "warn";
  ms?: number;
  /** Raw Qloo request summary, for the provenance drawer. */
  request?: string;
}

export interface HomeTaste {
  city: string;
  cuisines: string[];
  dishes: string[];
  landmarks: string[];
  places: Entity[];
}

export interface MemoryMap {
  personId: string;
  window: Window;
  seeds: Entity[];
  guessed: Entity[];
  profile: Tag[];
  domains: Partial<Record<Domain, Entity[]>>;
  home?: HomeTaste;
  place?: string;
  language?: string;
  life?: string[];
  opening?: string;
  together?: Together;
  session: Card[];
  trace: TraceStep[];
  builtAt: number;
}

export type ReactionKind = "joy" | "calm" | "none" | "distress";

export interface Reaction {
  cardKey: string;
  entityId: string;
  entityName: string;
  domain: Domain;
  kind: ReactionKind;
  note?: string;
  prompt?: string;
  at: number;
}

export interface SessionLog {
  id: string;
  personId: string;
  startedAt: number;
  reactions: Reaction[];
  summary?: string;
}

/** What the caregiver's history has taught the agent so far. */
export interface Learned {
  sparks: Entity[];
  avoidIds: string[];
  avoidTags: Tag[];
  notes: string[];
}

/** Events streamed by /api/build as NDJSON. */
export type BuildEvent =
  | { type: "step"; step: TraceStep }
  | { type: "seeds"; seeds: Entity[]; guessed: Entity[] }
  | { type: "domain"; domain: Domain; items: Entity[] }
  | { type: "home"; home: HomeTaste }
  | { type: "profile"; tags: Tag[] }
  | { type: "together"; together: Together }
  | { type: "done"; map: MemoryMap }
  | { type: "error"; message: string };

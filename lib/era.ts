import type { Entity, Window } from "./types";

/**
 * The reminiscence bump: people recall far more from roughly ages 10 to 30
 * than from any other part of life, and those memories survive dementia longest.
 */
export const BUMP_FROM_AGE = 10;
export const BUMP_TO_AGE = 30;

export function bumpWindow(birthYear: number, now = new Date().getFullYear()): Window {
  return { from: birthYear + BUMP_FROM_AGE, to: Math.min(birthYear + BUMP_TO_AGE, now) };
}

/** Qloo decade genre tags (urn:tag:genre:60s) that overlap the window. */
export function decadeTags(w: Window): string[] {
  const out: string[] = [];
  for (let d = Math.floor(w.from / 10) * 10; d <= w.to; d += 10) {
    out.push(`urn:tag:genre:${String(d).slice(2)}s`);
  }
  return out;
}

export function ageAt(year: number | undefined, birthYear: number) {
  return year === undefined ? undefined : year - birthYear;
}

/**
 * Was this artist on the radio while the person was 10 to 30?
 * Uses Qloo's career span when present, then date of birth, then decade tags.
 */
export function artistInEra(e: Entity, birthYear: number, w: Window): boolean {
  // Singers much younger than the listener broke through after the bump had closed.
  if (e.born !== undefined && e.born > birthYear + 6) return false;
  if (e.careerFrom !== undefined) {
    const end = e.careerTo ?? 9999;
    // Started by the time they were about 24, still working once the window opened,
    // and not already a fading act from a generation earlier.
    return e.careerFrom <= birthYear + 24 && end >= w.from + 2 && e.careerFrom >= birthYear - 35;
  }
  if (e.born !== undefined) return e.born >= birthYear - 45;
  const decades = decadeTags(w);
  return (e.tags ?? []).some((t) => decades.includes(t.id));
}

export function inWindow(year: number | undefined, w: Window, slack = 0) {
  return year !== undefined && year >= w.from - slack && year <= w.to + slack;
}

/**
 * Reminiscence can surface trauma. War, partition, violence and loss are screened out
 * by default; care guidance says to approach them only when the person leads there.
 */
const HEAVY =
  /\b(war|wartime|partition|holocaust|genocide|massacre|assassinat\w*|murder\w*|terror\w*|riots?|emergency|concentration camp|refugees?|suicide|abuse|torture|execution|nazi\w*|bomb\w*|famine|slavery|serial killer|kidnap\w*|rape|nymphet|pedophil\w*|paedophil\w*|incest|molest\w*|asylum|psychiatric|mental (?:hospital|institution|ward)|dementia|alzheimer\w*|cancer|funeral|grief)\b/i;

/** Whether a word or tag on its own names one of the screened themes. */
export const heavyWord = (s: string) => HEAVY.test(s);

/** Returns the matched theme when an item is screened out, otherwise undefined. */
export function heavyTheme(e: Entity): string | undefined {
  // Genres are left out on purpose: classics like Mughal-E-Azam carry a "War" genre
  // without being war films. For artists only the name counts, since a session plays
  // their songs: Lennon's death or an anti-war hit says little about "Imagine" at the
  // kitchen table. Faces are judged by their tags, because a portrait of JFK leads
  // straight to the assassination.
  const isWork = e.kind !== "artist" && e.kind !== "person";
  const tags = e.kind === "artist" ? [] : (e.tags ?? []).map((t) => t.name);
  const text = [e.name, ...(isWork ? [e.blurb, e.knownFor, ...(e.keywords ?? [])] : []), ...tags]
    .filter(Boolean)
    .join(" | ");
  return text.match(HEAVY)?.[0]?.toLowerCase();
}

export const isHeavy = (e: Entity) => heavyTheme(e) !== undefined;

/** Same artist under a different spelling, e.g. "Mohd Rafi" and "Mohammed Rafi". */
export function sameName(a: string, b: string) {
  const pa = a.toLowerCase().split(/\s+/).filter(Boolean);
  const pb = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (pa.join("") === pb.join("")) return true;
  return pa.length > 1 && pb.length > 1 && pa.at(-1) === pb.at(-1) && pa[0][0] === pb[0][0];
}

/** Ages 14 to 24 are the very peak of the bump; nudge those up. */
export function peakBoost(year: number | undefined, birthYear: number) {
  const a = ageAt(year, birthYear);
  if (a === undefined) return 0;
  return a >= 14 && a <= 24 ? 0.03 : 0;
}

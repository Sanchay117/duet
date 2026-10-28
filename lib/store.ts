"use client";
// Everything about a loved one lives in this browser only. No accounts, no server copy.
import { useMemo, useSyncExternalStore } from "react";
import type { Learned, MemoryMap, Person, SessionLog } from "./types";

const K = {
  people: "duet:people",
  map: (id: string) => `duet:map:${id}`,
  sessions: (id: string) => `duet:sessions:${id}`,
  learned: (id: string) => `duet:learned:${id}`,
};

const EVENT = "duet:store";
const EMPTY_LEARNED: Learned = { sparks: [], avoidIds: [], avoidTags: [], notes: [] };

function getRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  const raw = getRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the session still works in memory */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

export const store = {
  people: () => read<Person[]>(K.people, []),
  person: (id: string) => read<Person[]>(K.people, []).find((p) => p.id === id),
  savePerson(p: Person) {
    const all = read<Person[]>(K.people, []).filter((x) => x.id !== p.id);
    write(K.people, [p, ...all]);
  },
  removePerson(id: string) {
    for (const k of [K.map(id), K.sessions(id), K.learned(id)]) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    write(
      K.people,
      read<Person[]>(K.people, []).filter((x) => x.id !== id),
    );
  },
  map: (id: string) => read<MemoryMap | null>(K.map(id), null),
  saveMap: (m: MemoryMap) => write(K.map(m.personId), m),
  sessions: (id: string) => read<SessionLog[]>(K.sessions(id), []),
  saveSession(s: SessionLog) {
    const all = read<SessionLog[]>(K.sessions(s.personId), []).filter((x) => x.id !== s.id);
    write(K.sessions(s.personId), [s, ...all].slice(0, 30));
  },
  learned: (id: string) => read<Learned>(K.learned(id), EMPTY_LEARNED),
  saveLearned: (id: string, l: Learned) => write(K.learned(id), l),
};

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The raw stored string. undefined while rendering on the server, before the browser is read. */
function useRaw(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getRaw(key),
    () => undefined,
  );
}

function useParsed<T>(key: string, parse: (raw: string | null) => T): T | undefined {
  const raw = useRaw(key);
  return useMemo(() => {
    if (raw === undefined) return undefined;
    try {
      return parse(raw);
    } catch {
      return parse(null);
    }
  }, [raw, parse]);
}

const parsePeople = (raw: string | null) => (raw ? (JSON.parse(raw) as Person[]) : []);
const parseMap = (raw: string | null) => (raw ? (JSON.parse(raw) as MemoryMap) : null);
const parseSessions = (raw: string | null) => (raw ? (JSON.parse(raw) as SessionLog[]) : []);
const parseLearned = (raw: string | null) => (raw ? (JSON.parse(raw) as Learned) : EMPTY_LEARNED);

/** undefined while loading, null when this device has no such person. */
export function usePerson(id: string): Person | null | undefined {
  const people = useParsed(K.people, parsePeople);
  return people === undefined ? undefined : (people.find((p) => p.id === id) ?? null);
}

export const useMap = (id: string) => useParsed(K.map(id), parseMap);
export const useSessions = (id: string) => useParsed(K.sessions(id), parseSessions);
export const useLearned = (id: string) => useParsed(K.learned(id), parseLearned);

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

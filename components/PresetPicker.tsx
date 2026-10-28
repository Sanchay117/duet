"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRESETS } from "@/lib/presets";
import { newId, store } from "@/lib/store";
import { Icon } from "./ui";

/** Reuse an existing copy of the preset so a second visit is instant. */
function ensurePreset(key: string) {
  const { key: _key, tagline: _tagline, photoHue: _hue, ...person } = PRESETS.find((x) => x.key === key)!;
  const existing = store.people().find((x) => x.name === person.name && x.birthYear === person.birthYear && x.hometown === person.hometown);
  if (existing) return existing.id;
  const id = newId();
  store.savePerson({ ...person, id, createdAt: Date.now() });
  return id;
}

export function PresetPicker() {
  const router = useRouter();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => router.push(`/p/${ensurePreset(p.key)}`)}
          className="group text-left rounded-2xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(34,28,21,.45)] focus-visible:outline-2 focus-visible:outline-clay"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full serif text-lg text-paper" style={{ background: p.photoHue }} aria-hidden>
              {p.name[0]}
            </span>
            <div>
              <div className="serif text-xl leading-tight">{p.name}</div>
              <div className="text-xs text-ink-3">
                b. {p.birthYear} · {p.hometown.split(",")[0]}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-2 leading-relaxed">{p.tagline}</p>
          {p.family && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-sage">
              <Icon name="pair" size={14} className="mt-0.5 shrink-0" />
              <span>
                With a grandchild{p.family.birthYear ? ` born ${p.family.birthYear}` : ""} who loves {p.family.loves.split(",").slice(0, 2).join(" and ").replace(/\s+/g, " ").trim()}
              </span>
            </p>
          )}
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay-2">
            Open {p.pronoun === "he" ? "his" : "her"} memory map
            <Icon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5" />
          </span>
        </button>
      ))}
      <Link
        href="/new"
        className="group rounded-2xl border border-dashed border-ink-3/50 p-5 flex flex-col justify-between transition hover:border-clay hover:bg-card focus-visible:outline-2 focus-visible:outline-clay"
      >
        <div>
          <div className="serif text-xl">Someone you love</div>
          <p className="mt-2 text-sm text-ink-2 leading-relaxed">A birth year, a hometown, and a sentence or two about what they loved. Two minutes.</p>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay-2">
          Start <Icon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}

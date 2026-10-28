"use client";
import { useState } from "react";
import { domainOf } from "@/lib/domain";
import type { Family, Person, SharedItem, Together } from "@/lib/types";
import { Chip, Icon, Poster, provenance, Spinner } from "./ui";

function pronouns(p?: string) {
  if (p === "he") return { sub: "he", obj: "him", pos: "his", own: "his" };
  if (p === "they") return { sub: "they", obj: "them", pos: "their", own: "theirs" };
  return { sub: "she", obj: "her", pos: "her", own: "hers" };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function listOf(names: string[]) {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The family member's half of the duet: what they love, and where it meets the person's taste. */
export function CommonGround({
  person,
  together,
  loves,
  loading,
  onSave,
}: {
  person: Person;
  together?: Together;
  /** Ids of what the family told us they love. */
  loves: Set<string>;
  loading: boolean;
  onSave: (family: Family) => void;
}) {
  const [editing, setEditing] = useState(false);
  const pr = pronouns(person.pronoun);
  const family = person.family;

  if (!family?.loves || editing) {
    return (
      <FamilyForm
        person={person}
        initial={family}
        onCancel={family?.loves ? () => setEditing(false) : undefined}
        onSave={(f) => {
          setEditing(false);
          onSave(f);
        }}
      />
    );
  }

  return (
    <section className="rise mb-12" aria-labelledby="common-ground">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 id="common-ground" className="serif whitespace-nowrap text-3xl">
          Common ground
        </h2>
        <span className="h-px flex-1 bg-line" />
        <button onClick={() => setEditing(true)} className="whitespace-nowrap text-sm text-clay-2 underline-offset-2 hover:underline">
          <span className="sm:hidden">Edit yours</span>
          <span className="hidden sm:inline">Change what you love</span>
        </button>
      </div>

      {!together ? (
        loading ? (
          <p className="flex items-center gap-2 py-6 text-ink-2">
            <Spinner className="text-clay" /> Asking Qloo where your taste and {person.name}&apos;s meet…
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-5 text-ink-2">
            This map was made before you added what you love.{" "}
            <button onClick={() => onSave(family)} className="font-medium text-clay-2 underline underline-offset-2">
              Find your common ground
            </button>
          </div>
        )
      ) : (
        <>
          <p className="max-w-3xl text-ink-2">
            You love {listOf(together.yours.map((e) => e.name)) || family.loves}. Qloo ranked {person.name}&apos;s years by your
            taste, and your years by {pr.own}.
          </p>

          {together.pairs.length > 0 && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {together.pairs.map((p) => {
                const hersLoved = loves.has(p.hers.id);
                return (
                  <article key={p.yours.id} className="rounded-2xl border border-line bg-card p-4">
                    <div className="flex items-start gap-2">
                      <figure className="min-w-0 flex-1">
                        <Poster entity={p.yours} domain={domainOf(p.yours)} className="aspect-square w-full" rounded="rounded-xl" />
                        <figcaption className="mt-2">
                          <div className="serif truncate leading-tight">{p.yours.name}</div>
                          <div className="text-xs text-sage">You love</div>
                        </figcaption>
                      </figure>
                      <span className="mt-[22%] shrink-0 text-ink-3" aria-label="meets">
                        <Icon name="pair" size={22} />
                      </span>
                      <figure className="min-w-0 flex-1">
                        <Poster entity={p.hers} domain={domainOf(p.hers)} className="aspect-square w-full" rounded="rounded-xl" />
                        <figcaption className="mt-2">
                          <div className="serif truncate leading-tight">{p.hers.name}</div>
                          <div className="text-xs text-clay-2">{hersLoved ? `${cap(pr.pos)} love` : `From ${pr.pos} years`}</div>
                        </figcaption>
                      </figure>
                    </div>
                    {p.influenced && (
                      <p className="mt-3 text-sm text-ink-2">
                        Qloo lists {p.hers.name} among {p.yours.name}&apos;s influences.
                      </p>
                    )}
                    {p.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <SharedRow
              title={`From ${pr.pos} years, for you`}
              note={`${person.birthYear + 10}–${Math.min(person.birthYear + 30, new Date().getFullYear())}, ranked by your taste`}
              items={together.then}
              sub={(x) => provenance(x.entity, person.birthYear, pr.sub).join(" · ")}
              badge={`${cap(pr.pos)} favourite`}
              tone="clay"
            />
            <SharedRow
              title={`From your years, for ${pr.obj}`}
              note={`${together.years.from}–${together.years.to}, ranked by ${pr.pos} taste`}
              items={together.now}
              sub={(x) => (x.entity.year ? String(x.entity.year) : x.entity.born ? `born ${x.entity.born}` : "")}
              badge="You love this"
              tone="sage"
            />
          </div>
        </>
      )}
    </section>
  );
}

function SharedRow({
  title,
  note,
  items,
  sub,
  badge,
  tone,
}: {
  title: string;
  note: string;
  items: SharedItem[];
  sub: (x: SharedItem) => string;
  badge: string;
  tone: "clay" | "sage";
}) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h3 className="serif text-xl">{title}</h3>
        <span className="text-xs text-ink-3">{note}</span>
      </div>
      <div className="scroll-x -mx-5 flex gap-3 overflow-x-auto px-5 pb-3 lg:mx-0 lg:px-0">
        {items.map((x) => (
          <figure key={x.entity.id} className="w-28 shrink-0" title={x.entity.knownFor ?? x.entity.blurb}>
            <Poster entity={x.entity} domain={x.domain} className="aspect-[3/4] w-full" rounded="rounded-lg" />
            <figcaption className="mt-1.5">
              <div className="serif text-sm leading-tight">{x.entity.name}</div>
              {sub(x) && <div className="mt-0.5 text-[11px] text-ink-3">{sub(x)}</div>}
              {x.loved && (
                <Chip tone={tone} className="mt-1">
                  {badge}
                </Chip>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function FamilyForm({
  person,
  initial,
  onSave,
  onCancel,
}: {
  person: Person;
  initial?: Family;
  onSave: (f: Family) => void;
  onCancel?: () => void;
}) {
  const [loves, setLoves] = useState(initial?.loves ?? "");
  const [year, setYear] = useState(initial?.birthYear ? String(initial.birthYear) : "");
  const now = new Date().getFullYear();
  const y = Number(year);
  const yearOk = !year || (Number.isInteger(y) && y > 1900 && y <= now - 5);
  return (
    <section className="rise mb-12 rounded-3xl border border-dashed border-[color-mix(in_srgb,var(--clay)_45%,transparent)] bg-card p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-clay-2">Make it a duet</p>
      <h2 className="serif mt-1 text-3xl">And you? What do you love?</h2>
      <p className="mt-2 max-w-2xl text-ink-2">
        Name a few singers, films or shows of your own. Qloo finds where your taste and {person.name}&apos;s meet, decades apart, so
        the session has something in it for both of you.
      </p>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loves.trim() || !yearOk) return;
          onSave({ loves: loves.trim(), birthYear: year ? y : undefined });
        }}
      >
        <label className="block">
          <span className="sr-only">What you love</span>
          <input
            value={loves}
            onChange={(e) => setLoves(e.target.value)}
            placeholder="e.g. Arijit Singh, La La Land, Gilmore Girls"
            className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-clay"
            maxLength={400}
          />
        </label>
        <label className="block">
          <span className="sr-only">Your birth year (optional)</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Born (optional)"
            aria-invalid={!yearOk}
            className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-clay aria-[invalid=true]:border-rose"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!loves.trim() || !yearOk}
            className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-ink px-5 py-3 text-paper disabled:opacity-40 sm:flex-none"
          >
            <Icon name="pair" size={18} /> Find our common ground
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl px-3 py-3 text-ink-3 hover:text-ink">
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

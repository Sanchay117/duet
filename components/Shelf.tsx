import type { Domain, Entity } from "@/lib/types";
import { DOMAIN_META, Poster, provenance } from "./ui";

export function Shelf({
  domain,
  items,
  birthYear,
  pronoun,
  names,
  loading,
}: {
  domain: Domain;
  items?: Entity[];
  birthYear: number;
  pronoun: string;
  names: Map<string, string>;
  loading?: boolean;
}) {
  const meta = DOMAIN_META[domain];
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <section className="rise">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="serif text-2xl">{meta.label}</h3>
        <span className="h-px flex-1 bg-line" />
        {items && <span className="text-xs text-ink-3">{items.length} from Qloo</span>}
      </div>
      <div className="scroll-x -mx-5 flex gap-4 overflow-x-auto px-5 pb-3">
        {!items &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0">
              <div className="pulse-soft aspect-[3/4] rounded-xl bg-paper-2" />
              <div className="pulse-soft mt-2 h-3 w-24 rounded bg-paper-2" />
            </div>
          ))}
        {items?.map((e) => {
          const because = e.because?.map((id) => names.get(id)).filter(Boolean)[0];
          return (
            <figure key={e.id} className="w-36 shrink-0" title={e.knownFor ?? e.blurb}>
              <Poster entity={e} domain={domain} className="aspect-[3/4] w-full" />
              <figcaption className="mt-2">
                <div className="serif text-[15px] leading-tight">{e.name}</div>
                <div className="mt-0.5 text-xs text-ink-3">{provenance(e, birthYear, pronoun).join(" · ")}</div>
                {because && (
                  <div className="mt-0.5 truncate text-xs" style={{ color: meta.color }}>
                    via {because}
                  </div>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

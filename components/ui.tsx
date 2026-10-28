import type { Domain, Entity } from "@/lib/types";

export const DOMAIN_META: Record<Domain, { label: string; color: string; noun: string }> = {
  music: { label: "Songs", color: "var(--clay)", noun: "Music" },
  film: { label: "Films", color: "var(--sky)", noun: "Film" },
  tv: { label: "Television", color: "var(--gold)", noun: "Television" },
  stars: { label: "Faces", color: "var(--rose)", noun: "Face of the era" },
  books: { label: "Books", color: "var(--sage)", noun: "Book" },
  home: { label: "Taste of home", color: "var(--gold)", noun: "Home" },
};

/** Two voices, two eras, overlapping. */
export function Logo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="Duet">
      <svg width={size * 1.25} height={size} viewBox="0 0 40 32" aria-hidden>
        <circle cx="14" cy="16" r="12" fill={light ? "var(--glow)" : "var(--clay)"} />
        <circle cx="26" cy="16" r="12" fill={light ? "var(--paper)" : "var(--gold)"} fillOpacity={light ? 0.55 : 0.85} style={{ mixBlendMode: light ? "screen" : "multiply" }} />
      </svg>
      <span
        className="serif font-semibold tracking-[0.18em]"
        style={{ fontSize: size * 0.8, color: light ? "var(--paper)" : "var(--ink)" }}
      >
        DUET
      </span>
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`spin ${className}`} width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type IconName =
  | "sun"
  | "leaf"
  | "dot"
  | "cloud"
  | "mic"
  | "stop"
  | "play"
  | "speaker"
  | "arrow-right"
  | "arrow-left"
  | "check"
  | "x"
  | "spark"
  | "print"
  | "refresh"
  | "heart"
  | "shield"
  | "search"
  | "external"
  | "pair";

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    sun: (
      <>
        <circle cx="12" cy="12" r="4.5" {...p} />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" {...p} />
      </>
    ),
    leaf: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7" {...p} />,
    dot: <circle cx="12" cy="12" r="7" {...p} strokeDasharray="3 3" />,
    cloud: (
      <>
        <path d="M7 15a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 15H7z" {...p} />
        <path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" {...p} />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" {...p} />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...p} />
      </>
    ),
    stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />,
    play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
    speaker: (
      <>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...p} />
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...p} />
      </>
    ),
    "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" {...p} />,
    "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" {...p} />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" {...p} />,
    x: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" {...p} />,
    print: (
      <>
        <path d="M7 9V3.5h10V9M7 17H4.5V10h15v7H17" {...p} />
        <rect x="7" y="14" width="10" height="6.5" {...p} />
      </>
    ),
    refresh: <path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5M5 3v4h4M19 21v-4h-4" {...p} />,
    heart: <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" {...p} />,
    shield: <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z M8.5 12l2.5 2.5 4.5-5" {...p} />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" {...p} />
        <path d="M16 16l4.5 4.5" {...p} />
      </>
    ),
    external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" {...p} />,
    pair: (
      <>
        <circle cx="9" cy="12" r="6" {...p} />
        <circle cx="15" cy="12" r="6" {...p} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

/** Qloo image when there is one, otherwise a typographic tile in the domain colour. */
export function Poster({
  entity,
  domain,
  className = "",
  rounded = "rounded-xl",
  big = false,
}: {
  entity: Entity;
  domain: Domain;
  className?: string;
  rounded?: string;
  big?: boolean;
}) {
  const color = DOMAIN_META[domain].color;
  if (entity.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entity.image}
        alt={entity.name}
        loading="lazy"
        className={`${rounded} object-cover bg-paper-2 ${className}`}
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 8px 24px -12px rgba(34,28,21,.35)" }}
      />
    );
  }
  return (
    // Type and padding scale with the tile itself (cqw), so the same poster works as a thumbnail
    // or a hero. A percentage padding would follow the parent's width and burst a small tile.
    <div
      className={`${rounded} @container overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${color} 85%, white), ${color})`,
        color: "var(--paper)",
      }}
      aria-label={entity.name}
    >
      <div className="flex h-full w-full flex-col p-[8cqw]">
        <span className="hidden text-[10px] uppercase tracking-[0.2em] opacity-80 @[110px]:block">{DOMAIN_META[domain].noun}</span>
        <span className={`serif mt-auto break-words text-[8px] leading-tight @[70px]:text-sm @[140px]:text-lg ${big ? "@[240px]:text-4xl" : ""}`}>
          {entity.name}
        </span>
      </div>
    </div>
  );
}

export function Chip({ children, tone = "plain", className = "" }: { children: React.ReactNode; tone?: "plain" | "clay" | "sage" | "dark"; className?: string }) {
  const tones = {
    plain: "bg-card text-ink-2 border border-line",
    clay: "bg-[color-mix(in_srgb,var(--clay)_12%,transparent)] text-clay-2 border border-[color-mix(in_srgb,var(--clay)_25%,transparent)]",
    sage: "bg-[color-mix(in_srgb,var(--sage)_12%,transparent)] text-sage border border-[color-mix(in_srgb,var(--sage)_25%,transparent)]",
    dark: "bg-white/10 text-paper/90 border border-white/15",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${tones[tone]} ${className}`}>{children}</span>;
}

export function yearOf(e: Entity) {
  return e.year ?? e.careerFrom;
}

/** "1965 · she was 14" built only from data, never from the LLM. */
export function provenance(e: Entity, birthYear: number, pronoun = "she") {
  const out: string[] = [];
  if (e.year) {
    out.push(String(e.year));
    const age = e.year - birthYear;
    if (age >= 0) out.push(`${pronoun} was ${age}`);
  } else if (e.careerFrom) {
    out.push(`singing from ${e.careerFrom}`);
  } else if (e.born) {
    out.push(`born ${e.born}`);
  }
  return out;
}

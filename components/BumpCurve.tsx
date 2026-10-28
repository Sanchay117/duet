/** The reminiscence bump: share of autobiographical memories recalled, by age at the time. */
export function BumpCurve({ from = 10, to = 30, dark = false }: { from?: number; to?: number; dark?: boolean }) {
  const W = 520;
  const H = 230;
  const pad = { l: 28, r: 16, t: 20, b: 34 };
  const maxAge = 80;
  const x = (age: number) => pad.l + (age / maxAge) * (W - pad.l - pad.r);
  // Stylized from the classic lifespan retrieval curve: childhood amnesia, the bump, a long plateau, recency.
  const pts: [number, number][] = [
    [0, 0.02], [4, 0.05], [8, 0.18], [12, 0.48], [16, 0.82], [20, 0.95], [24, 0.84], [28, 0.6], [32, 0.42],
    [38, 0.32], [46, 0.27], [54, 0.25], [62, 0.27], [68, 0.33], [74, 0.48], [80, 0.7],
  ];
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const path = pts
    .map(([a, v], i) => {
      if (i === 0) return `M ${x(a)} ${y(v)}`;
      const [pa, pv] = pts[i - 1];
      const cx = (x(pa) + x(a)) / 2;
      return `C ${cx} ${y(pv)}, ${cx} ${y(v)}, ${x(a)} ${y(v)}`;
    })
    .join(" ");
  const ink = dark ? "rgba(245,238,226,.75)" : "var(--ink-3)";
  const accent = dark ? "var(--glow)" : "var(--clay)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Memory recall peaks for ages ${from} to ${to}`}>
      <defs>
        <linearGradient id="bumpFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <clipPath id="bumpClip">
          <rect x={x(from)} y={0} width={x(to) - x(from)} height={H} />
        </clipPath>
      </defs>
      <rect x={x(from)} y={pad.t - 6} width={x(to) - x(from)} height={H - pad.t - pad.b + 6} rx="10" fill={accent} opacity={dark ? 0.1 : 0.07} />
      <path d={`${path} L ${x(maxAge)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="url(#bumpFill)" clipPath="url(#bumpClip)" />
      <path d={path} fill="none" stroke={ink} strokeWidth="2" strokeOpacity="0.55" />
      <path d={path} fill="none" stroke={accent} strokeWidth="3" clipPath="url(#bumpClip)" />
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke={ink} strokeOpacity="0.4" />
      {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((a) => (
        <text key={a} x={x(a)} y={H - 12} textAnchor="middle" fontSize="11" fill={ink}>
          {a}
        </text>
      ))}
      <text x={x(from) + (x(to) - x(from)) / 2} y={pad.t + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={accent}>
        ages {from}–{to}
      </text>
      <text x={W - pad.r} y={H - 0} textAnchor="end" fontSize="10" fill={ink} opacity="0.8">
        age when the memory was made
      </text>
    </svg>
  );
}

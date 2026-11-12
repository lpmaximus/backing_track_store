import { COUNTRY_POS, LAND_DOTS, WORLD_VIEWBOX } from "@/src/lib/worldMap";

/**
 * Mapa-múndi pontilhado (server component, SVG puro, zero JS no cliente).
 * Terra em cinza; cada país da comunidade vira um ponto laranja com halo.
 * Sem contagem de pessoas — só onde estamos (decisão 2026-11-12).
 */
export default function WorldMap({ countries, label }: { countries: string[]; label: string }) {
  const pins = countries
    .map((c) => ({ c, p: COUNTRY_POS[c] }))
    .filter((x): x is { c: string; p: [number, number] } => Boolean(x.p));

  return (
    <svg viewBox={WORLD_VIEWBOX} role="img" aria-label={label} className="cm-map"
      style={{ width: "100%", height: "auto", display: "block" }}>
      <path d={LAND_DOTS} stroke="var(--border2)" strokeWidth={1.25} strokeLinecap="round" fill="none" />
      {pins.map(({ c, p: [x, y] }, i) => (
        <g key={c}>
          <circle cx={x} cy={y} r={7.5} fill="var(--accent)" className="cm-pulse"
            style={{ animationDelay: `${(i % 7) * 0.35}s` }} />
          <circle cx={x} cy={y} r={3.3} fill="var(--accent)" stroke="#fff" strokeWidth={0.9} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Logo oficial (BRD-001): pick com waveform + wordmark BACKING / TRACK / STORE.
 * variant "dark"  → pick preto, texto preto (fundos claros)
 * variant "light" → pick branco, texto branco (fundos escuros)
 */
export default function BrandLogo({ size = 34, variant = "dark" }: { size?: number; variant?: "dark" | "light" }) {
  const ink = variant === "dark" ? "#0D0D0F" : "#FFFFFF";
  const wave = variant === "dark" ? "#FFFFFF" : "#0D0D0F";
  const h = Math.round(size * 1.2);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={h} viewBox="0 0 100 120" aria-hidden>
        <path d="M50 4 C76 4 96 20 96 44 C96 74 70 104 50 116 C30 104 4 74 4 44 C4 20 24 4 50 4 Z" fill={ink} />
        <g fill={wave}>
          <rect x="26" y="48" width="4" height="12" rx="2" />
          <rect x="33" y="42" width="4" height="24" rx="2" />
          <rect x="40" y="34" width="4" height="40" rx="2" />
          <rect x="47" y="26" width="4" height="56" rx="2" />
          <rect x="54" y="34" width="4" height="40" rx="2" />
          <rect x="61" y="42" width="4" height="24" rx="2" />
          <rect x="68" y="48" width="4" height="12" rx="2" />
        </g>
      </svg>
      <span style={{ lineHeight: 1.1, textAlign: "left" }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: 12, color: ink, letterSpacing: "0.04em" }}>BACKING</span>
        <span style={{ display: "block", fontWeight: 800, fontSize: 12, color: ink, letterSpacing: "0.04em" }}>TRACK</span>
        <span style={{ display: "block", fontWeight: 700, fontSize: 10, color: "#FF9A00", letterSpacing: "0.35em" }}>STORE</span>
      </span>
    </span>
  );
}

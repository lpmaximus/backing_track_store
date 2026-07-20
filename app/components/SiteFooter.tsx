import Link from "next/link";
import BrandLogo from "./BrandLogo";

const COLUMNS: { title: string; links: { label: string; href: string; disabled?: boolean }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Separar Stems",          href: "/upload" },
      { label: "Minhas Músicas",         href: "/perfil" },
      { label: "Músicas Compartilhadas", href: "/compartilhadas" },
      { label: "Setlists",               href: "/setlists" },
      { label: "Bandas",                 href: "/bandas" },
      // Em beta não vendemos planos ainda — link fica desabilitado (sem navegação).
      { label: "Planos",                 href: "/planos", disabled: true },
      { label: "Como funciona",          href: "/como-funciona" },
    ],
  },
  {
    title: "Sobre",
    links: [
      { label: "Sobre nós",           href: "/sobre" },
      { label: "Contato",             href: "/contato" },
      { label: "Termos de Uso",       href: "/termos" },
      { label: "Privacidade",         href: "/privacidade" },
      { label: "Política de Cookies", href: "/cookies" },
    ],
  },
];

const SOCIAL = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10.5 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M14 8.5h-1.4a1.6 1.6 0 00-1.6 1.6V11h3l-.4 2h-2.6v6h-2v-6H7v-2h1.6V9.7A3 3 0 0111.5 6.6H14z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const LANGUAGES = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "en",    label: "English" },
  { code: "es",    label: "Español" },
];

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", marginTop: 48, background: "var(--surface)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 24px 28px" }}>

        {/* Colunas */}
        <div className="footer-grid" style={{ marginBottom: 36 }}>
          {/* Marca + idioma + redes sociais */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <BrandLogo size={30} variant="dark" />
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5, fontWeight: 400, lineHeight: 1.7, margin: "0 0 18px", maxWidth: 280 }}>
              Backing tracks com cifra sincronizada para músicos amadores e profissionais. Toque, ensaie e suba ao palco.
            </p>

            {/* Seletor de idioma (placeholder visual — i18n ainda não implementado) */}
            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 6 }}>
                IDIOMA
              </span>
              <select
                defaultValue="pt-BR"
                aria-label="Selecionar idioma"
                title="Em breve: troca de idioma"
                style={{
                  background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border2)",
                  borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "not-allowed", maxWidth: 200,
                }}
                disabled
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>

            {/* Redes sociais — apenas ícones, sem link (ainda não temos perfis ativos) */}
            <div style={{ display: "flex", gap: 10 }}>
              {SOCIAL.map(({ label, icon }) => (
                <span key={label} aria-label={label} title={label} style={{
                  width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border2)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--muted)",
                }}>
                  {icon}
                </span>
              ))}
            </div>
          </div>

          {/* Colunas de links */}
          {COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 14 }}>
                {title.toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(({ label, href, disabled }) => (
                  disabled ? (
                    <span key={label} className="footer-link" title="Em breve"
                      style={{ cursor: "default", opacity: 0.6 }}>
                      {label}
                    </span>
                  ) : (
                    <Link key={label} href={href} className="footer-link">{label}</Link>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Linha inferior */}
        <div style={{
          borderTop: "1px solid var(--border)", paddingTop: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, textAlign: "center" }}>
            © 2026 <span style={{ color: "var(--text)", fontWeight: 600 }}>BackingTrack.store</span> — Conectando músicos através da música
          </p>
        </div>
      </div>
    </footer>
  );
}

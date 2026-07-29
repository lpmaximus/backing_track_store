import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { StaticPathname } from "@/src/i18n/routing";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";

type FooterLink = { key: string; href: StaticPathname; disabled?: boolean };

const COLUMNS: { titleKey: "productTitle" | "aboutTitle"; links: FooterLink[] }[] = [
  {
    titleKey: "productTitle",
    links: [
      { key: "separateStems", href: "/upload" },
      { key: "mySongs", href: "/perfil" },
      { key: "sharedSongs", href: "/compartilhadas" },
      { key: "setlists", href: "/setlists" },
      { key: "bands", href: "/bandas" },
      // Em beta não vendemos planos ainda — link fica desabilitado (sem navegação).
      { key: "pricing", href: "/planos", disabled: true },
      { key: "howItWorks", href: "/como-funciona" },
    ],
  },
  {
    titleKey: "aboutTitle",
    links: [
      { key: "about", href: "/sobre" },
      { key: "contact", href: "/contato" },
      { key: "terms", href: "/termos" },
      { key: "privacy", href: "/privacidade" },
      { key: "cookies", href: "/cookies" },
    ],
  },
];

const SOCIAL = [
  {
    label: "Instagram",
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
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="M10.5 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M14 8.5h-1.4a1.6 1.6 0 00-1.6 1.6V11h3l-.4 2h-2.6v6h-2v-6H7v-2h1.6V9.7A3 3 0 0111.5 6.6H14z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default async function SiteFooter() {
  const t = await getTranslations("footer");

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
              {t("tagline")}
            </p>

            {/* Seletor de idioma — funcional (ADR-BTS-006) */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 6 }}>
                {t("language")}
              </span>
              <LanguageSwitcher />
            </div>

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
          {COLUMNS.map(({ titleKey, links }) => (
            <div key={titleKey}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 14 }}>
                {t(titleKey).toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(({ key, href, disabled }) => {
                  const label = t(`links.${key}`);
                  return disabled ? (
                    <span key={key} className="footer-link" style={{ cursor: "default", opacity: 0.6 }}>
                      {label}
                    </span>
                  ) : (
                    <Link key={key} href={href} className="footer-link">{label}</Link>
                  );
                })}
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
            {t.rich("copyright", {
              // string, não number: senão o Intl formata como "2.026"
              year: String(new Date().getFullYear()),
              b: (chunks) => <span style={{ color: "var(--text)", fontWeight: 600 }}>{chunks}</span>,
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}

import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/src/i18n/navigation";
import UserMenu from "./UserMenu";
import BrandLogo from "./BrandLogo";
import MobileNav, { type NavItem } from "./MobileNav";

export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const t = await getTranslations("nav");

  // Nav dinâmica: itens de músicas/setlists/bandas só para logados;
  // Moderação só para admin (e fora do i18n — o admin segue em português).
  const nav: NavItem[] = [
    { label: t("home"), href: "/" },
    { label: t("catalog"), href: "/catalogo" },
    ...(user
      ? ([
          { label: t("shared"), href: "/compartilhadas" },
          { label: t("mySongs"), href: "/perfil" },
          { label: t("upload"), href: "/upload" },
          { label: t("setlists"), href: "/setlists" },
          { label: t("bands"), href: "/bandas" },
        ] as NavItem[])
      : []),
  ];

  return (
    <header style={{
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div className="header-row" style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        height: 76, display: "flex", alignItems: "center", gap: 40,
      }}>
        {/* Logo — pick + wordmark (BRD-001) */}
        <Link href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <BrandLogo size={32} variant="dark" />
        </Link>

        {/* Nav completa — vira hamburguer abaixo de 880px (ver MobileNav) */}
        <nav className="desktop-nav" style={{ display: "flex", gap: 28, flex: 1, flexWrap: "wrap" }}>
          {nav.map(({ label, href }) => (
            <Link key={label} href={href} className="nav-link">{label}</Link>
          ))}
          {/* Moderação sai do mapa de rotas do i18n: /admin não é traduzido. */}
          {user?.role === "admin" && (
            <a href="/admin/moderacao" className="nav-link">{t("moderation")}</a>
          )}
        </nav>

        {/* Busca rápida */}
        <Link href="/catalogo" aria-label={t("searchSongs")} title={t("searchSongs")} className="nav-link" style={{ display: "flex", alignItems: "center" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </Link>

        {/* Auth */}
        {user ? (
          <UserMenu user={{ name: user.name ?? null, email: user.email ?? "", image: user.image ?? null, role: user.role }} />
        ) : (
          <div className="auth-buttons" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/entrar" style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 600, borderRadius: 8,
              border: "1px solid var(--border2)", color: "var(--text)", background: "var(--surface)",
            }}>
              {t("signIn")}
            </Link>
            <Link href="/entrar" style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 700, borderRadius: 8,
              background: "var(--text)", color: "#fff",
              display: "inline-flex", alignItems: "center",
            }}>
              {t("startFree")}
            </Link>
          </div>
        )}

        {/* Hamburguer — só visível abaixo de 880px */}
        <MobileNav
          nav={nav}
          labels={{ open: t("openMenu"), close: t("closeMenu") }}
        />
      </div>
    </header>
  );
}

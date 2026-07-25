import Link from "next/link";
import { auth } from "@/auth";
import UserMenu from "./UserMenu";
import BrandLogo from "./BrandLogo";
import MobileNav from "./MobileNav";

export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  // Nav dinâmica: itens de músicas/setlists/bandas só para logados;
  // Moderação só para admin.
  const nav = [
    { label: "Home", href: "/" },
    { label: "Catálogo", href: "/catalogo" },
    ...(user
      ? [
          { label: "Enviar", href: "/upload" },
          { label: "Minhas Músicas", href: "/perfil" },
          { label: "Compartilhadas", href: "/compartilhadas" },
          { label: "Setlists", href: "/setlists" },
          { label: "Bandas", href: "/bandas" },
        ]
      : []),
    ...(user?.role === "admin" ? [{ label: "Moderação", href: "/admin/moderacao" }] : []),
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
        </nav>

        {/* Busca rápida */}
        <Link href="/catalogo" aria-label="Buscar músicas" title="Buscar" className="nav-link" style={{ display: "flex", alignItems: "center" }}>
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
              Entrar
            </Link>
            <Link href="/entrar" style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 700, borderRadius: 8,
              background: "var(--text)", color: "#fff",
              display: "inline-flex", alignItems: "center",
            }}>
              Começar grátis
            </Link>
          </div>
        )}

        {/* Hamburguer — só visível abaixo de 880px */}
        <MobileNav nav={nav} />
      </div>
    </header>
  );
}

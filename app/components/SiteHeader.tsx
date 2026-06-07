import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import UserMenu from "./UserMenu";

const NAV = [
  { label: "Explorar", href: "/" },
  { label: "Gêneros",  href: "/#catalogo" },
  { label: "Planos",   href: "/planos" },
];

export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header style={{
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        height: 72, display: "flex", alignItems: "center", gap: 40,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Image src="/logo-bts.png" alt="BTS" width={40} height={40} style={{ borderRadius: 10 }} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: 11, color: "var(--text)", letterSpacing: "0.12em" }}>BACKING</div>
            <div style={{ fontWeight: 800, fontSize: 11, color: "var(--accent)", letterSpacing: "0.12em" }}>TRACK STORE</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 24, flex: 1 }}>
          {NAV.map(({ label, href }) => (
            <Link key={label} href={href} className="nav-link">{label}</Link>
          ))}
        </nav>

        {/* Busca rápida */}
        <Link href="/#catalogo" aria-label="Buscar músicas" title="Buscar" className="nav-link" style={{ fontSize: 17, display: "flex", alignItems: "center" }}>
          🔍
        </Link>

        {/* Auth */}
        {user ? (
          <UserMenu user={{ name: user.name ?? null, email: user.email ?? "", image: user.image ?? null, role: user.role }} />
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/entrar" className="nav-link" style={{ fontWeight: 600 }}>Entrar</Link>
            <span
              aria-disabled="true"
              title="Em breve — ainda não vendemos planos durante o beta"
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 14,
                background: "var(--surface3)", color: "var(--muted2)",
                cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
                border: "1px solid var(--border2)",
              }}
            >
              Seja Pro <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>(em breve)</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

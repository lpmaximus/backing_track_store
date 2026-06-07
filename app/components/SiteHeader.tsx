import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import UserMenu from "./UserMenu";

const NAV = [
  { label: "Explorar", href: "/" },
  { label: "Planos",   href: "/planos" },
];

export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header style={{
      background: "rgba(15,15,15,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        height: 64, display: "flex", alignItems: "center", gap: 40,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <Image src="/logo-bts.png" alt="BTS" width={40} height={40} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, fontSize: 11, color: "#fff", letterSpacing: "0.12em" }}>BACKING</div>
            <div style={{ fontWeight: 900, fontSize: 11, color: "var(--accent)", letterSpacing: "0.12em" }}>TRACK STORE</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 24, flex: 1 }}>
          {NAV.map(({ label, href }) => (
            <Link key={label} href={href} className="nav-link">{label}</Link>
          ))}
        </nav>

        {/* Auth */}
        {user ? (
          <UserMenu user={{ name: user.name ?? null, email: user.email ?? "", image: user.image ?? null, role: user.role }} />
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/entrar" className="nav-link" style={{ fontWeight: 600 }}>Entrar</Link>
            <Link href="/planos" className="btn-primary" style={{ padding: "8px 20px", fontSize: 13 }}>Seja Pro</Link>
          </div>
        )}
      </div>
    </header>
  );
}

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      marginTop: 48,
      background: "var(--surface)",
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "28px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        {/* Brand */}
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          © 2026 <span style={{ color: "var(--text)", fontWeight: 600 }}>BackingTrack.store</span> — Para músicos, por músicos.
        </p>

        {/* Links */}
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Termos", href: "/termos" },
            { label: "Privacidade", href: "/privacidade" },
            { label: "Contato", href: "/contato" },
            { label: "FAQ", href: "/faq" },
          ].map(({ label, href }) => (
            <Link key={label} href={href} className="footer-link">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

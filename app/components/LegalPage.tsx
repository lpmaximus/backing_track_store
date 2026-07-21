import Link from "next/link";

export default function LegalPage({
  title,
  effectiveDate,
  updated,
  children,
}: {
  title: string;
  effectiveDate: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 24px 80px" }}>
      <Link href="/" className="footer-link" style={{ fontSize: 13 }}>
        ← Voltar ao início
      </Link>

      <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "18px 0 8px" }}>
        {title}
      </h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 32px" }}>
        Em vigor a partir de: {effectiveDate}
        {updated ? ` · Última atualização: ${updated}` : ""}
      </p>

      <div className="legal-content">{children}</div>
    </div>
  );
}

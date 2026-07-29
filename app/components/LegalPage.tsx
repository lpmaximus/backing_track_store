import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";

export default async function LegalPage({
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
  const t = await getTranslations("legal");

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 24px 80px" }}>
      <Link href="/" className="footer-link" style={{ fontSize: 13 }}>
        {t("backHome")}
      </Link>

      <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "18px 0 8px" }}>
        {title}
      </h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 32px" }}>
        {t("effective", { date: effectiveDate })}
        {updated ? t("updated", { date: updated }) : ""}
      </p>

      <div className="legal-content">{children}</div>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/src/i18n/navigation";

/**
 * Banner promocional do plano Free — topo da home.
 *
 * Objetivo: converter o visitante anônimo em conta gratuita mostrando, de uma
 * vez só, TUDO o que o Free entrega. A lista vem de `pricing.freeFeatures`
 * (mesma fonte da página /planos) para não haver duas verdades sobre o que o
 * Free inclui — se um item mudar lá, muda aqui.
 *
 * Server component: some para quem já está logado (não faz sentido pedir
 * cadastro a quem já tem conta).
 */
export default async function FreePromoBanner() {
  const session = await auth();
  if (session?.user) return null;

  const t = await getTranslations("freePromo");
  const tp = await getTranslations("pricing");

  // next-intl devolve arrays via t.raw — as 6 vantagens do Free.
  const features = tp.raw("freeFeatures") as string[];

  return (
    <section
      aria-labelledby="free-promo-title"
      style={{
        background: "var(--text)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "34px 24px 36px",
        }}
      >
        <div className="freepromo-grid">
          {/* Coluna 1 — chamada */}
          <div>
            <span
              style={{
                display: "inline-block",
                background: "var(--accent)",
                color: "#0D0D0F",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              {t("badge")}
            </span>
            <h2
              id="free-promo-title"
              style={{
                color: "#fff",
                fontSize: "clamp(24px, 3.2vw, 34px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.12,
                margin: "14px 0 0",
              }}
            >
              {t.rich("title", {
                accent: (chunks) => (
                  <span style={{ color: "var(--accent)" }}>{chunks}</span>
                ),
              })}
            </h2>
            <p
              style={{
                color: "#aaa",
                fontSize: 14.5,
                lineHeight: 1.65,
                margin: "12px 0 0",
                maxWidth: 420,
              }}
            >
              {t("subtitle")}
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
              <Link
                href={{ pathname: "/entrar", query: { tab: "cadastro" } }}
                style={{
                  display: "inline-block",
                  background: "var(--accent)",
                  color: "#0D0D0F",
                  fontWeight: 800,
                  fontSize: 14.5,
                  padding: "13px 26px",
                  borderRadius: 8,
                }}
              >
                {t("cta")}
              </Link>
              <Link
                href="/catalogo"
                style={{
                  display: "inline-block",
                  border: "1px solid #3a3a42",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14.5,
                  padding: "13px 26px",
                  borderRadius: 8,
                }}
              >
                {t("ctaSecondary")}
              </Link>
            </div>

            <div style={{ color: "#8a8a92", fontSize: 12, marginTop: 14 }}>
              {t("note")}
            </div>

            {/* Teste do Pro é por convite (gerado no /admin/convites) — não há
                auto-atendimento, então o link manda pedir pelo contato. A
                duração varia por convite, por isso não citamos nº de dias. */}
            <div style={{ color: "#8a8a92", fontSize: 12, marginTop: 8 }}>
              {t.rich("trial", {
                link: (chunks) => (
                  <Link
                    href="/contato"
                    style={{ color: "var(--accent)", fontWeight: 600 }}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </div>
          </div>

          {/* Coluna 2 — todas as vantagens do Free */}
          <ul
            className="freepromo-list"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {features.map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  color: "#e6e6ea",
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: "9px 0",
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 2 }}
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import { getPrice, getYearlySavings, type PlanId } from "@/src/lib/pricingIntl";
import FaqSection, { type FaqItem } from "@/app/components/FaqSection";
import BlurredPrice from "@/app/components/BlurredPrice";

export default function PlanosContent() {
  const { data: session } = useSession();
  const locale = useLocale() as Locale;
  const t = useTranslations("pricing");
  const tp = useTranslations("plans");

  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  const PLANOS_FAQ: FaqItem[] = [1, 2, 3, 4].map((n) => ({
    q: t(`faq.q${n}`),
    a: t(`faq.a${n}`),
  }));

  // Assinaturas desabilitadas durante o beta — checkout (handleSubscribe) removido.
  // Preço vem de src/lib/pricingIntl: BRL em português, USD em inglês.
  const priceOf = (plan: PlanId) => {
    const p = getPrice(plan, plan === "free" ? "monthly" : cycle, locale);
    if (plan === "free") return p.formatted;
    return `${p.formatted}${cycle === "monthly" ? tp("perMonth") : tp("perYear")}`;
  };

  const savingsOf = (plan: PlanId) =>
    cycle === "yearly" ? t("savings", { amount: getYearlySavings(plan, locale).formatted }) : "";

  /**
   * Os três planos vêm da landing (fonte de verdade acordada): o Free já tem
   * stems no player; o que o Pro acrescenta é o EXPORT dos stems. Manter as
   * duas telas com a mesma promessa é o ponto — ver CON-BTS-002.
   */
  const CARDS: {
    id: PlanId;
    tier: string;
    features: string[];
    highlight: boolean;
  }[] = [
    { id: "free", tier: tp("free"), features: t.raw("freeFeatures") as string[], highlight: false },
    { id: "pro", tier: tp("pro"), features: t.raw("proFeatures") as string[], highlight: true },
    { id: "band", tier: tp("band"), features: t.raw("bandFeatures") as string[], highlight: false },
  ];

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 24px 80px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h1 style={{ fontSize: "clamp(32px, 8vw, 48px)", fontWeight: 900, color: "var(--text)", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
          {t("title")}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 18, margin: 0 }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Toggle mensal/anual */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: 4, display: "flex", gap: 4 }}>
          {(["monthly", "yearly"] as const).map(p => (
            <button key={p} onClick={() => setCycle(p)}
              style={{
                padding: "8px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14,
                background: cycle === p ? "var(--accent)" : "transparent",
                color: cycle === p ? "#000" : "var(--muted)",
                transition: "all 0.15s",
              }}>
              {p === "monthly" ? t("monthly") : t("yearly")}
              {p === "yearly" && <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4 }}>{t("yearlyDiscount")}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="planos-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40, alignItems: "start" }}>
        {CARDS.map(({ id, tier, features, highlight }) => {
          const isFree = id === "free";
          // "Tudo do Free/Pro, mais:" é cabeçalho da lista, não um item.
          const headerLine = isFree ? null : features[0];

          return (
            <div key={id} style={{
              background: highlight
                ? "linear-gradient(160deg, #ffffff 0%, #fff4e0 100%)"
                : "var(--surface)",
              border: highlight ? "1px solid rgba(255,154,0,0.35)" : "1px solid var(--border)",
              borderRadius: 16,
              padding: "28px 26px 32px",
              position: "relative",
            }}>
              {highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}>
                  <span style={{ background: "var(--accent)", color: "#000", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 500, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                    {t("mostPopular")}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8,
                  color: highlight ? "var(--accent)" : "var(--muted)",
                }}>
                  {tier}
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, color: "var(--text)" }}>
                  {isFree
                    ? priceOf(id)
                    : <BlurredPrice srLabel={tp("priceHidden")}>{priceOf(id)}</BlurredPrice>}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                  {isFree ? tp("forever") : t("trial")}
                  {!isFree && savingsOf(id)
                    ? <BlurredPrice srLabel={tp("priceHidden")}>{savingsOf(id)}</BlurredPrice>
                    : null}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {features.map(f => {
                  const isHeader = f === headerLine;
                  return (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                      <span style={{ color: isHeader ? "var(--muted)" : highlight ? "var(--accent)" : "var(--muted)", flexShrink: 0, marginTop: 1 }}>
                        {isHeader ? "→" : "✓"}
                      </span>
                      <span style={{
                        color: isHeader ? "var(--muted2)" : highlight ? "var(--text)" : "var(--muted)",
                        fontStyle: isHeader ? "italic" : "normal",
                      }}>
                        {f}
                      </span>
                    </div>
                  );
                })}
              </div>

              {isFree ? (
                <Link href="/" style={{
                  display: "block", textAlign: "center", padding: "11px 0",
                  border: "1px solid var(--border2)", borderRadius: 500,
                  color: "var(--muted)", fontWeight: 600, fontSize: 14,
                }}>
                  {t("exploreFree")}
                </Link>
              ) : isPro && id === "pro" ? (
                <div style={{ textAlign: "center", padding: "11px 0", background: "rgba(255,154,0,0.15)", border: "1px solid rgba(255,154,0,0.3)", borderRadius: 500, color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
                  {t("alreadyPro")}
                </div>
              ) : (
                <div
                  aria-disabled="true"
                  title={tp("soonTitle")}
                  style={{
                    width: "100%", textAlign: "center", padding: "13px 0", fontSize: 14, fontWeight: 700,
                    borderRadius: 500, background: "var(--surface3)", color: "var(--muted2)",
                    cursor: "not-allowed", border: "1px solid var(--border2)",
                  }}
                >
                  {t("notAvailable")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ — mesmo componente da home (app/components/FaqSection.tsx),
          mas com as perguntas de cobrança. */}
      <div style={{ marginTop: 48 }}>
        <FaqSection items={PLANOS_FAQ} />
      </div>

    </main>
  );
}

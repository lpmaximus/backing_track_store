"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import { getPrice, getYearlySavings } from "@/src/lib/pricingIntl";
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

  const FREE_FEATURES = t.raw("freeFeatures") as string[];
  const PRO_FEATURES = t.raw("proFeatures") as string[];
  const EVERYTHING_IN_FREE = PRO_FEATURES[0];

  // Assinaturas desabilitadas durante o beta — checkout (handleSubscribe) removido.
  // Preço vem de src/lib/pricingIntl: BRL em português, USD em inglês.
  const pro = getPrice("pro", cycle, locale);
  const free = getPrice("free", "monthly", locale);
  const priceLabel = `${pro.formatted}${cycle === "monthly" ? tp("perMonth") : tp("perYear")}`;
  const savings =
    cycle === "yearly" ? t("savings", { amount: getYearlySavings("pro", locale).formatted }) : "";

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 80px" }}>

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
      <div className="planos-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>

        {/* Free */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 28px 32px" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 }}>{tp("free")}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)" }}>{free.formatted}</div>
            <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{tp("forever")}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 24 }}>
            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                <span style={{ color: "var(--muted)", flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ color: "var(--muted)" }}>{f}</span>
              </div>
            ))}
          </div>
          <Link href="/" style={{
            display: "block", textAlign: "center", padding: "11px 0",
            border: "1px solid var(--border2)", borderRadius: 500,
            color: "var(--muted)", fontWeight: 600, fontSize: 14,
          }}>
            {t("exploreFree")}
          </Link>
        </div>

        {/* Pro */}
        <div style={{
          background: "linear-gradient(160deg, #ffffff 0%, #fff4e0 100%)",
          border: "1px solid rgba(255,154,0,0.35)", borderRadius: 16, padding: "28px 28px 32px",
          position: "relative" as const,
        }}>
          <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)" }}>
            <span style={{ background: "var(--accent)", color: "#000", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 500, letterSpacing: "0.08em" }}>
              {t("mostPopular")}
            </span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 8 }}>{tp("pro")}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)" }}>
              <BlurredPrice srLabel={tp("priceHidden")}>{priceLabel}</BlurredPrice>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              {t("trial")}
              {savings ? <BlurredPrice srLabel={tp("priceHidden")}>{savings}</BlurredPrice> : null}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 24 }}>
            {PRO_FEATURES.map(f => {
              // A primeira linha é o "Tudo do Free, mais:" — cabeçalho, não item.
              const isHeader = f === EVERYTHING_IN_FREE;
              return (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                  <span style={{ color: isHeader ? "var(--muted)" : "var(--accent)", flexShrink: 0, marginTop: 1 }}>
                    {isHeader ? "→" : "✓"}
                  </span>
                  <span style={{ color: isHeader ? "var(--muted2)" : "var(--text)", fontStyle: isHeader ? "italic" : "normal" as const }}>
                    {f}
                  </span>
                </div>
              );
            })}
          </div>

          {isPro ? (
            <div style={{ textAlign: "center", padding: "11px 0", background: "rgba(255,154,0,0.15)", border: "1px solid rgba(255,154,0,0.3)", borderRadius: 500, color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
              {t("alreadyPro")}
            </div>
          ) : (
            <div
              aria-disabled="true"
              title={tp("soonTitle")}
              style={{
                width: "100%", textAlign: "center", padding: "13px 0", fontSize: 15, fontWeight: 700,
                borderRadius: 500, background: "var(--surface3)", color: "var(--muted2)",
                cursor: "not-allowed", border: "1px solid var(--border2)",
              }}
            >
              {t("notAvailable")}
            </div>
          )}
        </div>
      </div>

      {/* FAQ — mesmo componente da home (app/components/FaqSection.tsx),
          mas com as perguntas de cobrança. */}
      <div style={{ marginTop: 48 }}>
        <FaqSection items={PLANOS_FAQ} />
      </div>

    </main>
  );
}

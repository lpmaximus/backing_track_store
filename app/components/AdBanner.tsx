"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * Banner estático exibido apenas para usuários do plano Free (incluindo visitantes
 * não autenticados). Usuários Pro e admin não veem anúncios.
 *
 * Hoje renderiza uma peça estática própria (placeholder de patrocínio / cross-sell
 * para o plano Pro). Quando a conta do Google AdSense for aprovada, basta substituir
 * o conteúdo do bloco `<div className="ad-slot">` pelo snippet oficial:
 *
 *   <ins className="adsbygoogle"
 *        style={{ display: "block" }}
 *        data-ad-client="ca-pub-XXXXXXXXXXXXXXX"
 *        data-ad-slot="XXXXXXXXXX"
 *        data-ad-format="auto"
 *        data-full-width-responsive="true" />
 *
 * ...e carregar o script do AdSense via <Script> no layout (fora deste componente).
 */
export default function AdBanner({ variant = "default" }: { variant?: "default" | "compact" }) {
  const { data: session } = useSession();
  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  if (isPro) return null;

  const compact = variant === "compact";

  return (
    <div
      className="ad-slot"
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--border2)",
        borderRadius: 12,
        padding: compact ? "14px 18px" : "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted2)",
        border: "1px solid var(--border2)", borderRadius: 4, padding: "2px 6px", flexShrink: 0,
      }}>
        PUBLICIDADE
      </span>
      <p style={{ flex: 1, minWidth: 200, color: "var(--muted)", fontSize: compact ? 13 : 14, margin: 0 }}>
        Quer tocar sem anúncios e desbloquear stems, pitch shift e setlists ilimitadas?
      </p>
      <Link href="/planos" className="btn-primary" style={{ padding: "8px 18px", fontSize: 12, flexShrink: 0, whiteSpace: "nowrap" }}>
        Conheça o Pro
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const FREE_FEATURES = [
  "Catalogo completo (todas as musicas)",
  "Player com mix completo sem voz",
  "Cifra sincronizada em tempo real",
  "Controle de velocidade basico",
  "Historico 30 dias",
  "Ler comentarios da comunidade",
];

const PRO_FEATURES = [
  "Tudo do Free, mais:",
  "Stems individuais (bateria, baixo, guitarra, harmonia)",
  "Pitch shift em tempo real",
  "Loop A-B (trecho para repetir)",
  "Setlist nomeada para shows",
  "Modo Performance (tela cheia, offline)",
  "Escrever e responder comentarios",
  "Historico ilimitado",
  "Offline (PWA)",
];

export default function PlanosContent() {
  const { data: session } = useSession();

  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  // Assinaturas desabilitadas durante o beta — checkout (handleSubscribe) removido.
  const price = plan === "monthly" ? "R$19,90/mês" : "R$149/ano";
  const savings = plan === "yearly" ? " (economize R$90,80)" : "";

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 24px 80px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: "var(--text)", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
          Escolha seu plano
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 18, margin: 0 }}>
          7 dias gratis — cancele quando quiser, sem fidelidade.
        </p>
      </div>

      {/* Toggle mensal/anual */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: 4, display: "flex", gap: 4 }}>
          {(["monthly", "yearly"] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)}
              style={{
                padding: "8px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14,
                background: plan === p ? "var(--accent)" : "transparent",
                color: plan === p ? "#000" : "var(--muted)",
                transition: "all 0.15s",
              }}>
              {p === "monthly" ? "Mensal" : "Anual"}
              {p === "yearly" && <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4 }}>-38%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>

        {/* Free */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 28px 32px" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 }}>FREE</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)" }}>R$0</div>
            <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>para sempre</div>
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
            Explorar gratis
          </Link>
        </div>

        {/* Pro */}
        <div style={{
          background: "linear-gradient(160deg, #ffffff 0%, #eafbf1 100%)",
          border: "1px solid rgba(29,185,84,0.35)", borderRadius: 16, padding: "28px 28px 32px",
          position: "relative" as const,
        }}>
          <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)" }}>
            <span style={{ background: "var(--accent)", color: "#000", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 500, letterSpacing: "0.08em" }}>
              MAIS POPULAR
            </span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 8 }}>PRO</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text)" }}>{price}</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              7 dias gratis{savings}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 24 }}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                <span style={{ color: f.includes("Tudo") ? "var(--muted)" : "var(--accent)", flexShrink: 0, marginTop: 1 }}>
                  {f.includes("Tudo") ? "→" : "✓"}
                </span>
                <span style={{ color: f.includes("Tudo") ? "var(--muted2)" : "var(--text)", fontStyle: f.includes("Tudo") ? "italic" : "normal" as const }}>
                  {f}
                </span>
              </div>
            ))}
          </div>

          {isPro ? (
            <div style={{ textAlign: "center", padding: "11px 0", background: "rgba(29,185,84,0.15)", border: "1px solid rgba(29,185,84,0.3)", borderRadius: 500, color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
              ✓ Voce ja e Pro
            </div>
          ) : (
            <div
              aria-disabled="true"
              title="Em breve — ainda não vendemos planos durante o beta"
              style={{
                width: "100%", textAlign: "center", padding: "13px 0", fontSize: 15, fontWeight: 700,
                borderRadius: 500, background: "var(--surface3)", color: "var(--muted2)",
                cursor: "not-allowed", border: "1px solid var(--border2)",
              }}
            >
              Em breve — assinaturas ainda não disponíveis
            </div>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {[
          { q: "Preciso de cartao de credito?", a: "Nao! Voce pode pagar com PIX ou boleto." },
          { q: "Como funciona o trial de 7 dias?", a: "Voce acessa tudo do Pro. A primeira cobranca so ocorre apos 7 dias." },
          { q: "Posso cancelar quando quiser?", a: "Sim. Sem multa, sem fidelidade. Cancele pelo painel a qualquer momento." },
          { q: "O que acontece se cancelar?", a: "Voce volta para o plano Free imediatamente, sem perder suas cifras salvas." },
        ].map(({ q, a }) => (
          <div key={q} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, margin: "0 0 8px" }}>{q}</p>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{a}</p>
          </div>
        ))}
      </div>

    </main>
  );
}

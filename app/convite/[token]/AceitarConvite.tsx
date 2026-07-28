"use client";

/**
 * Botão de ativação do trial. Exige um clique consciente do usuário já logado —
 * o convite nunca "ativa sozinho" ao abrir o link, para que a pessoa saiba
 * exatamente o que aceitou e quando.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AceitarConvite({ token, days }: { token: string; days: number }) {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function ativar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível ativar agora.");
        return;
      }
      setDone(true);
      // Recarrega o JWT para o novo role valer na hora (sem novo login).
      await update();
      setTimeout(() => router.push("/"), 1200);
    } catch {
      setError("Falha de conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p style={{ color: "var(--accent)", fontSize: 15, fontWeight: 700, textAlign: "center" }}>
        Teste ativado. Levando você ao catálogo…
      </p>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <button onClick={ativar} disabled={loading} className="btn-primary" style={{ padding: "13px 28px" }}>
        {loading ? "Ativando…" : `Ativar meus ${days} dias`}
      </button>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}
      <p style={{ color: "var(--muted2)", fontSize: 12, margin: "12px 0 0" }}>
        Sem cartão. No fim do período a conta volta sozinha para o gratuito.
      </p>
    </div>
  );
}

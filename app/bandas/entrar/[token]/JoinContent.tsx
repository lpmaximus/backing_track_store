"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type State = { phase: "idle" | "joining" | "done" | "error"; bandName?: string; error?: string };

export default function JoinContent({ token }: { token: string }) {
  const { data: session, status } = useSession();
  const [state, setState] = useState<State>({ phase: "idle" });

  useEffect(() => {
    if (status !== "authenticated") return;
    if (state.phase !== "idle") return;
    setState({ phase: "joining" });
    (async () => {
      try {
        const res = await fetch(`/api/bands/join/${token}`, { method: "POST" });
        const data = await res.json();
        if (res.ok) setState({ phase: "done", bandName: data.band?.name });
        else setState({ phase: "error", error: data.error ?? "Convite inválido" });
      } catch {
        setState({ phase: "error", error: "Erro de conexão" });
      }
    })();
  }, [status, token, state.phase]);

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center" as const };

  return (
    <div style={{ flex: 1, maxWidth: 520, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
      {status === "loading" ? null : !session?.user ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>Convite de banda</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>Entre na sua conta para aceitar o convite.</p>
          <Link href={`/entrar?callbackUrl=/bandas/entrar/${token}`} className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>Entrar</Link>
        </div>
      ) : state.phase === "done" ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>Você entrou na banda! 🎉</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
            {state.bandName ? <>Agora você faz parte de <strong>{state.bandName}</strong>.</> : "Participação confirmada."}
          </p>
          <Link href="/bandas" className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>Ver minhas bandas</Link>
        </div>
      ) : state.phase === "error" ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>Não foi possível entrar</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{state.error}</p>
        </div>
      ) : (
        <div style={card}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Entrando na banda…</p>
        </div>
      )}
    </div>
  );
}

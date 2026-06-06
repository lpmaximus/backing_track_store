"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function EntrarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [tab,      setTab]      = useState<"login" | "cadastro">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl });
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (tab === "cadastro") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao criar conta");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email, password, redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha incorretos");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--surface)",
        border: "1px solid var(--border2)",
        borderRadius: 16,
        padding: "36px 32px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
            Backing<span style={{ color: "var(--accent)" }}>Track</span>.store
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            {tab === "login" ? "Entre na sua conta" : "Crie sua conta grátis"}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {(["login", "cadastro"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14,
                background: tab === t ? "var(--surface3)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--muted)",
                transition: "all 0.15s",
              }}>
              {t === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid var(--border2)",
            background: "var(--surface2)", color: "var(--text)", fontWeight: 600, fontSize: 14,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            marginBottom: 20,
          }}>
          <span style={{ fontSize: 18 }}>G</span>
          Continuar com Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ color: "var(--muted2)", fontSize: 12 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleCredentials} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "cadastro" && (
            <input
              type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)}
              required
              style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none" }}
            />
          )}
          <input
            type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />
          <input
            type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={8}
            style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: "4px 0 0", textAlign: "center" }}>{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "13px 0" }}>
            {loading ? "Carregando..." : tab === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", margin: "20px 0 0" }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "underline" }}>
            Voltar ao catálogo
          </Link>
        </p>
      </div>
    </div>
  );
}

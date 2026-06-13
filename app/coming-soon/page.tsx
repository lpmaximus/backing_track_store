"use client";

import { useState } from "react";

export default function ComingSoonPage() {
  const [email, setEmail]     = useState("");
  const [status, setStatus]   = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus("ok");
        setMessage("Perfeito! Você será um dos primeiros a saber.");
        setEmail("");
      } else {
        const data = await res.json();
        setStatus("error");
        setMessage(data.error || "Algo deu errado. Tente novamente.");
      }
    } catch {
      setStatus("error");
      setMessage("Sem conexão. Tente novamente.");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Logo / Selo */}
      <div style={{
        width: 96, height: 96, borderRadius: "50%",
        border: "2px solid #222",
        background: "#111",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 40,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.05em", color: "#fff" }}>★ BTS ★</div>
        </div>
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: "clamp(36px, 8vw, 72px)",
        fontWeight: 900,
        lineHeight: 0.95,
        letterSpacing: "-0.03em",
        textAlign: "center",
        color: "#fff",
        margin: "0 0 20px",
        maxWidth: 700,
      }}>
        Backing tracks<br />
        <span style={{ color: "#1db954" }}>+ cifras.</span><br />
        Em breve.
      </h1>

      {/* Subtítulo */}
      <p style={{
        color: "#888",
        fontSize: "clamp(15px, 2.5vw, 18px)",
        textAlign: "center",
        lineHeight: 1.7,
        maxWidth: 500,
        margin: "0 0 48px",
      }}>
        Toque, ensaie e se apresente com bases profissionais
        e cifras sincronizadas em tempo real — sem anúncio no meio.
      </p>

      {/* Form */}
      {status !== "ok" ? (
        <form onSubmit={handleSubmit} style={{
          width: "100%", maxWidth: 420,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{
            display: "flex",
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: 15,
                padding: "14px 18px",
              }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                background: "#1db954",
                color: "#fff",
                border: "none",
                padding: "14px 22px",
                fontWeight: 700,
                fontSize: 14,
                cursor: status === "loading" ? "wait" : "pointer",
                letterSpacing: "0.02em",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              {status === "loading" ? "..." : "Avisar-me"}
            </button>
          </div>

          {status === "error" && (
            <p style={{ color: "#f44", fontSize: 13, margin: 0, textAlign: "center" }}>
              {message}
            </p>
          )}

          <p style={{ color: "#444", fontSize: 12, textAlign: "center", margin: 0 }}>
            Sem spam. Só um aviso quando lançarmos.
          </p>
        </form>
      ) : (
        <div style={{
          background: "rgba(29,185,84,0.1)",
          border: "1px solid rgba(29,185,84,0.3)",
          borderRadius: 12,
          padding: "18px 28px",
          textAlign: "center",
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎵</div>
          <p style={{ color: "#1db954", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>
            Você está na lista!
          </p>
          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
            {message}
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div style={{
        position: "absolute",
        bottom: 32,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}>
        <span style={{ color: "#333", fontSize: 12 }}>backingtrack.store</span>
        <span style={{ color: "#222", fontSize: 12 }}>·</span>
        <a href="mailto:l2techs.ia@gmail.com" style={{ color: "#444", fontSize: 12, textDecoration: "none" }}>
          l2techs.ia@gmail.com
        </a>
        <span style={{ color: "#222", fontSize: 12 }}>·</span>
        <span style={{ color: "#333", fontSize: 12 }}>© {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminPassword, setAdminPassword } from "./adminClient";

const NAV = [
  { href: "/admin", label: "📈 Dashboard" },
  { href: "/admin/musicas", label: "🎼 Músicas" },
  { href: "/admin/usuarios", label: "👥 Usuários" },
  { href: "/admin/audio", label: "🎵 Áudio" },
  { href: "/admin/moderacao", label: "📝 Cifras" },
  { href: "/admin/consumo", label: "📊 Consumo" },
  { href: "/admin/analytics", label: "🌐 Audiência" },
  { href: "/admin/mensagens", label: "📣 Mensagens" },
];

// Valida a senha contra um endpoint admin (401 se errada).
async function test(candidate: string): Promise<boolean> {
  const res = await fetch("/api/admin/consumo", { headers: { "x-admin-password": candidate } });
  return res.status !== 401;
}

export default function AdminGate({ title, children }: { title: string; children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const saved = getAdminPassword();
      if (saved && (await test(saved))) setAuthed(true);
      setChecking(false);
    })();
  }, []);

  async function submit() {
    if (!pw) { setErr("Digite a senha"); return; }
    if (await test(pw)) { setAdminPassword(pw); setAuthed(true); setErr(""); }
    else setErr("Senha incorreta");
  }

  if (checking) {
    return <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>Carregando…</div>;
  }

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 40, maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Admin · {title}</h1>
          <input type="password" placeholder="Senha de acesso" value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 16px", borderRadius: 8, width: "100%", marginBottom: 12, fontSize: 15, boxSizing: "border-box" }} />
          {err && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{err}</p>}
          <button onClick={submit} style={{ background: "#f59e0b", color: "#000", border: "none", padding: "12px 0", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer", width: "100%" }}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "var(--muted)", fontSize: 20, marginRight: 6 }}>←</Link>
          <strong style={{ color: "var(--text)", fontSize: 16, marginRight: 12 }}>Admin</strong>
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={n.href}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                  background: active ? "#f59e0b" : "var(--surface2)", color: active ? "#000" : "var(--muted)", border: "1px solid var(--border)" }}>
                {n.label}
              </Link>
            );
          })}
        </div>
      </header>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>{children}</div>
    </div>
  );
}

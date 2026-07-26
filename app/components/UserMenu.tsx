"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { isProRole, roleLabel } from "@/src/lib/roles";

type Props = {
  user: { name: string | null; email: string; image: string | null; role: string };
};

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const isPro = isProRole(user.role);
  const tier = roleLabel(user.role);

  // Badge de mensagens não lidas (Área do Usuário). Busca ao montar e sempre
  // que o dropdown é aberto — sem polling contínuo pra não gerar tráfego à toa.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (!cancelled && d) setUnread(d.unread ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
        <div style={{ position: "relative" }}>
          {user.image ? (
            <Image src={user.image} alt={user.name ?? "User"} width={34} height={34} style={{ borderRadius: "50%", border: "2px solid var(--border2)" }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid var(--border2)", color: "var(--text)" }}>
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </div>
          )}
          {unread > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: "50%",
              background: "var(--accent)", border: "2px solid var(--surface)",
            }} />
          )}
        </div>
        {isPro ? (
          <span className="pro-badge">{tier}</span>
        ) : (
          <span style={{
            background: "var(--surface3)", color: "var(--muted)",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
            padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border2)",
          }}>{tier}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
            padding: 8, minWidth: 240, maxWidth: 320, boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name ?? "Usuario"}
                </span>
                {isPro ? (
                  <span className="pro-badge" style={{ flexShrink: 0 }}>{tier}</span>
                ) : (
                  <span style={{
                    background: "var(--surface3)", color: "var(--muted)",
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                    padding: "2px 7px", borderRadius: 6, border: "1px solid var(--border2)", flexShrink: 0,
                  }}>{tier}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
            <div style={{ padding: "8px 0" }}>
              {!isPro && (
                <Link href="/planos" onClick={() => setOpen(false)}
                  style={{ display: "block", padding: "8px 12px", borderRadius: 6, color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>
                  Fazer upgrade Pro
                </Link>
              )}
              {isPro && (
                <Link href="/setlists" onClick={() => setOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 6, color: "var(--muted)", fontSize: 13 }}>
                  Minhas Setlists
                </Link>
              )}
              <Link href="/conta" onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, color: "var(--muted)", fontSize: 13 }}>
                <span>Área Usuário</span>
                {unread > 0 && (
                  <span style={{
                    background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 800,
                    padding: "1px 7px", borderRadius: 10, lineHeight: "15px",
                  }}>{unread}</span>
                )}
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 6, background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

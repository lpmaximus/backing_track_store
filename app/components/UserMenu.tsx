"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  user: { name: string | null; email: string; image: string | null; role: string };
};

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const isPro = user.role === "pro" || user.role === "admin";

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
        {user.image ? (
          <Image src={user.image} alt={user.name ?? "User"} width={34} height={34} style={{ borderRadius: "50%", border: "2px solid var(--border2)" }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid var(--border2)", color: "var(--text)" }}>
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
        {isPro && <span className="pro-badge">PRO</span>}
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
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name ?? "Usuario"}
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
              <Link href="/perfil" onClick={() => setOpen(false)}
                style={{ display: "block", padding: "8px 12px", borderRadius: 6, color: "var(--muted)", fontSize: 13 }}>
                Perfil
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

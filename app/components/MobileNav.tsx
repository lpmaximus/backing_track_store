"use client";

import { useState } from "react";
import { Link } from "@/src/i18n/navigation";
import type { StaticPathname } from "@/src/i18n/routing";

/** href é validado contra o mapa de rotas do i18n (src/i18n/routing.ts). */
export type NavItem = { label: string; href: StaticPathname };

/** Menu hamburguer para telas estreitas (tablet/celular) — a nav completa
 *  (.desktop-nav) some abaixo de 880px e este botão assume no lugar dela. */
export default function MobileNav({
  nav,
  labels,
}: {
  nav: NavItem[];
  labels: { open: string; close: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-nav" style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        className="mobile-nav-toggle"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 6, alignItems: "center", justifyContent: "center", color: "var(--text)" }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "fixed", top: 76, left: 0, right: 0, zIndex: 50,
            background: "var(--surface)", borderBottom: "1px solid var(--border)",
            padding: "10px 24px 18px", display: "flex", flexDirection: "column",
            boxShadow: "0 12px 32px rgba(0,0,0,0.10)", maxHeight: "calc(100vh - 76px)", overflowY: "auto",
          }}>
            {nav.map(({ label, href }) => (
              <Link key={label} href={href} onClick={() => setOpen(false)}
                style={{ padding: "12px 2px", fontSize: 15, fontWeight: 600, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

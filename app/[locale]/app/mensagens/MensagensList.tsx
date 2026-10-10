"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Item = { id: number; title: string; body: string | null; href: string | null; read: boolean; date: string };

export default function MensagensList({ items }: { items: Item[] }) {
  const t = useTranslations("app.messages");
  // Abriu a caixa = leu. O destaque some só na próxima visita, para a pessoa
  // ainda ver o que era novo agora.
  const [unread] = useState(() => new Set(items.filter((i) => !i.read).map((i) => i.id)));
  useEffect(() => {
    if (unread.size > 0) void fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {});
  }, [unread]);

  if (items.length === 0) {
    return <div className="app-card"><p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>{t("empty")}</p></div>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((n) => {
        const isNew = unread.has(n.id);
        const body = (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              {isNew && <span aria-label={t("new")} style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", flexShrink: 0, alignSelf: "center" }} />}
              <span style={{ flex: 1, fontSize: 15, fontWeight: isNew ? 700 : 600 }}>{n.title}</span>
              <span style={{ fontSize: 11, color: "var(--muted2)", flexShrink: 0 }}>{n.date}</span>
            </div>
            {n.body && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)", whiteSpace: "pre-line" }}>{n.body}</p>}
          </>
        );
        const style: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 16, borderColor: isNew ? "rgba(255,154,0,0.35)" : undefined };
        return (
          <li key={n.id}>
            {n.href ? <a href={n.href} className="app-card" style={style}>{body}</a> : <div className="app-card" style={style}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

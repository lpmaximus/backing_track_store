"use client";

/**
 * /admin/mural — moderação do mural "De onde você toca" da home.
 * Nada aparece no site sem passar por aqui. Aprovar, recusar ou apagar atualiza a home na hora.
 */
import { useCallback, useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Post = {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  content: string;
  locale: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  moderatedAt: string | null;
  userEmail: string | null;
};

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["pt-BR"], { type: "region" })
  : null;
function countryName(c: string | null) {
  if (!c) return "país não informado";
  try { return regionNames?.of(c) ?? c; } catch { return c; }
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" } as const;
const btn = (bg: string, fg: string, border = "none") =>
  ({ background: bg, color: fg, border, borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }) as const;

function MuralLoader() {
  const [pending, setPending] = useState<Post[]>([]);
  const [done, setDone] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mural", { headers: adminHeaders() });
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setPending(data.pending ?? []);
      setDone(data.done ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id: number, action: "approve" | "reject" | "delete") {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/mural", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ id, action }) });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  // Exclusão definitiva (some do banco). Pede confirmação: não tem desfazer.
  function remove(p: Post) {
    if (window.confirm(`Excluir de vez o recado de ${p.name}? Isso não pode ser desfeito.`)) void act(p.id, "delete");
  }
  const delBtn = btn("transparent", "var(--danger)", "1px solid var(--danger)");

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando mural…</p>;
  if (error) return <p style={{ color: "var(--danger)" }}>Não foi possível carregar o mural. A migração (_add_community_wall.mjs) já rodou?</p>;

  const head = (p: Post) => (
    <>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
        {p.name} <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 13 }}>· {[p.city, countryName(p.country)].filter(Boolean).join(", ")}</span>
      </div>
      <p style={{ color: "var(--text)", fontSize: 14, margin: "6px 0 0", lineHeight: 1.55 }}>{p.content}</p>
      <p style={{ color: "var(--muted2)", fontSize: 11, margin: "6px 0 0" }}>
        {fmt(p.createdAt)} · {p.locale ?? "?"} · {p.userEmail ?? "sem conta"}
      </p>
    </>
  );

  return (
    <div style={{ width: "100%" }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>Mural da home</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px" }}>
        Recados de “De onde você toca?”. Só aparece no site o que for aprovado aqui (na hora).
      </p>

      <h2 style={{ fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, margin: "0 0 12px" }}>
        AGUARDANDO ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic", marginBottom: 32 }}>Nenhum recado pendente.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {pending.map((p) => (
            <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 320px" }}>{head(p)}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button disabled={busy === p.id} onClick={() => act(p.id, "approve")} style={btn("var(--accent)", "#000")}>Publicar</button>
                <button disabled={busy === p.id} onClick={() => act(p.id, "reject")} style={btn("var(--surface2)", "var(--text)", "1px solid var(--border2)")}>Recusar</button>
                <button disabled={busy === p.id} onClick={() => remove(p)} style={delBtn}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, margin: "0 0 12px" }}>
        JÁ MODERADOS
      </h2>
      {done.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>Nada moderado ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {done.map((p) => (
            <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 320px", opacity: p.status === "rejected" ? 0.6 : 1 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: p.status === "approved" ? "var(--accent)" : "var(--muted2)" }}>
                  {p.status === "approved" ? "NO AR" : "RECUSADO"}
                </span>
                {head(p)}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {p.status === "approved"
                  ? <button disabled={busy === p.id} onClick={() => act(p.id, "reject")} style={btn("var(--surface2)", "var(--text)", "1px solid var(--border2)")}>Tirar do ar</button>
                  : <button disabled={busy === p.id} onClick={() => act(p.id, "approve")} style={btn("var(--surface2)", "var(--text)", "1px solid var(--border2)")}>Publicar</button>}
                <button disabled={busy === p.id} onClick={() => remove(p)} style={delBtn}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MuralAdminPage() {
  return (
    <AdminGate title="Mural">
      <MuralLoader />
    </AdminGate>
  );
}

"use client";

/**
 * Meu Estúdio — as versões que a pessoa pegou do catálogo.
 *
 * O que existe aqui é folha de configuração, não cópia de áudio: renomear e
 * ligar/desligar faixa mexe só na SUA versão. A música do catálogo continua
 * igual para todo mundo, e "devolver" não apaga nada além da configuração —
 * as gravações continuam guardadas e reaparecem se a pessoa pegar de novo.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import Image from "next/image";
import { roleCan } from "@/src/lib/permissions";

type Versao = {
  id: number;
  songId: number;
  title: string;
  disabledStems: string[];
  songTitle: string;
  songArtist: string;
  songSlug: string;
  songThumbnailUrl: string | null;
};

export default function EstudioContent() {
  const { data: session, status } = useSession();
  const t = useTranslations("studio");

  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const podeUsar = roleCan(session?.user?.role, "copy_song");

  useEffect(() => {
    if (status === "loading") return;
    if (!podeUsar) { setCarregando(false); return; }

    let vivo = true;
    fetch("/api/estudio")
      .then(r => (r.ok ? r.json() : { versions: [] }))
      .then((d: { versions?: Versao[] }) => { if (vivo) setVersoes(d.versions ?? []); })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [podeUsar, status]);

  const renomear = useCallback(async (v: Versao, novo: string) => {
    const limpo = novo.trim().slice(0, 255);
    if (limpo === v.title) return;
    // Nome apagado volta a seguir o título do catálogo — é como se desfaz o
    // rename sem precisar de um botão só para isso.
    const exibido = limpo || v.songTitle;
    setVersoes(prev => prev.map(x => (x.id === v.id ? { ...x, title: exibido } : x)));
    await fetch(`/api/estudio/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: limpo }),
    });
  }, []);

  const devolver = useCallback(async (v: Versao) => {
    if (!confirm(t("confirmRemove", { name: v.title }))) return;
    setOcupado(v.id);
    try {
      const res = await fetch(`/api/estudio/${v.id}`, { method: "DELETE" });
      if (res.ok) setVersoes(prev => prev.filter(x => x.id !== v.id));
    } finally {
      setOcupado(null);
    }
  }, [t]);

  const caixa = { maxWidth: 900, margin: "0 auto", padding: "40px 24px 72px", width: "100%" } as const;

  if (status === "loading" || carregando) {
    return (
      <main style={caixa}>
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          {t("loading")}
        </p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main style={caixa}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: "0 0 12px" }}>{t("title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("signInFirst")}</p>
      </main>
    );
  }

  if (!podeUsar) {
    return (
      <main style={caixa}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: "0 0 12px" }}>{t("title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>{t("studioOnly")}</p>
        <Link href="/planos" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
          {t("seePlans")}
        </Link>
      </main>
    );
  }

  return (
    <main style={caixa}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: "0 0 6px" }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, margin: "0 0 28px" }}>
        {t("subtitle")}
      </p>

      {versoes.length === 0 ? (
        <div style={{
          border: "1px dashed var(--border2)", borderRadius: 12, padding: "34px 24px", textAlign: "center",
        }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px", lineHeight: 1.7 }}>
            {t("empty")}
          </p>
          <Link href="/catalogo" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
            {t("goCatalog")}
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {versoes.map(v => (
            <div key={v.id} style={{
              display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "12px 16px", opacity: ocupado === v.id ? 0.5 : 1,
            }}>
              {v.songThumbnailUrl ? (
                <Image src={v.songThumbnailUrl} alt="" width={46} height={46}
                  style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div aria-hidden="true" style={{
                  width: 46, height: 46, borderRadius: 8, background: "var(--surface2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                }}>🎵</div>
              )}

              <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                <input
                  defaultValue={v.title}
                  onBlur={e => renomear(v, e.target.value)}
                  maxLength={255}
                  aria-label={t("nameLabel")}
                  style={{
                    width: "100%", padding: "6px 9px", borderRadius: 6, fontSize: 14, fontWeight: 600,
                    border: "1px solid transparent", background: "transparent", color: "var(--text)",
                  }}
                  onFocus={e => { e.target.style.borderColor = "var(--border2)"; e.target.style.background = "var(--surface2)"; }}
                />
                <div style={{ fontSize: 12, color: "var(--muted2)", paddingLeft: 9 }}>
                  {v.songArtist}
                  {v.disabledStems.length > 0 && ` · ${t("tracksOff", { n: v.disabledStems.length })}`}
                </div>
              </div>

              <Link
                href={{ pathname: "/song/[slug]", params: { slug: v.songSlug } }}
                style={{
                  padding: "8px 16px", borderRadius: 500, fontSize: 13, fontWeight: 700,
                  background: "var(--accent)", color: "#000", textDecoration: "none",
                }}
              >
                {t("open")}
              </Link>
              <button
                onClick={() => devolver(v)}
                style={{
                  padding: "8px 14px", borderRadius: 500, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--muted)",
                }}
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

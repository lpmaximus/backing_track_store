"use client";

/**
 * Meu Estúdio — o que a pessoa tem em mãos para trabalhar.
 *
 * Duas prateleiras, e elas não se misturam de propósito:
 *
 *  · MÚSICAS DO CATÁLOGO que ela pegou. O que existe aqui é folha de
 *    configuração, não cópia de áudio: renomear, desligar faixa e cortar trecho
 *    mexe só na SUA versão. A música continua igual para todo mundo, e
 *    "devolver" não apaga nada além da configuração — as gravações continuam
 *    guardadas e reaparecem se ela pegar de novo.
 *
 *  · PROJETOS — músicas criadas aqui dentro, do zero, sem vínculo com áudio
 *    nenhum. A linha do tempo nasce vazia e as faixas são as gravações dela
 *    (microfone ou arquivo). Aqui não existe catálogo por trás: apagar apaga
 *    mesmo, com as gravações junto.
 *
 * Separar as duas listas é o que faz "Devolver" e "Apagar" poderem ter botões
 * diferentes sem que ninguém confunda um com o outro.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/navigation";
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
  /** 'studio_project' = projeto em branco criado aqui; qualquer outro = catálogo. */
  songSourceType?: string | null;
};

export default function EstudioContent() {
  const { data: session, status } = useSession();
  const t = useTranslations("studio");
  const router = useRouter();

  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);

  // Formulário de música nova. Fechado por padrão: o Estúdio é para trabalhar
  // no que já existe, e criar do zero é a ação menos frequente das duas.
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoBpm, setNovoBpm] = useState("100");
  const [novoTom, setNovoTom] = useState("C");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

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

  const devolver = useCallback(async (v: Versao, ehProjeto: boolean) => {
    // Duas perguntas diferentes porque são duas consequências diferentes:
    // devolver preserva as gravações, apagar o projeto leva tudo junto.
    const pergunta = ehProjeto
      ? t("confirmDeleteProject", { name: v.title })
      : t("confirmRemove", { name: v.title });
    if (!confirm(pergunta)) return;
    setOcupado(v.id);
    try {
      const res = await fetch(`/api/estudio/${v.id}`, { method: "DELETE" });
      if (res.ok) setVersoes(prev => prev.filter(x => x.id !== v.id));
    } finally {
      setOcupado(null);
    }
  }, [t]);

  const criarProjeto = useCallback(async () => {
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const res = await fetch("/api/estudio/projeto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: novoNome,
          bpm: Number(novoBpm) || undefined,
          key: novoTom,
        }),
      });
      const d = (await res.json().catch(() => null)) as
        | { song?: { slug: string }; error?: string }
        | null;
      if (!res.ok || !d?.song) {
        setErroNovo(d?.error ?? t("createError"));
        return;
      }
      // Vai direto para a música nova: o próximo passo é sempre adicionar a
      // primeira faixa, e ele só existe lá dentro.
      router.push({ pathname: "/song/[slug]", params: { slug: d.song.slug } });
    } catch {
      setErroNovo(t("createError"));
    } finally {
      setSalvandoNovo(false);
    }
  }, [novoNome, novoBpm, novoTom, router, t]);

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

  const projetos = versoes.filter(v => v.songSourceType === "studio_project");
  const doCatalogo = versoes.filter(v => v.songSourceType !== "studio_project");

  const linha = (v: Versao, ehProjeto: boolean) => (
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
        }}>{ehProjeto ? "🎛️" : "🎵"}</div>
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
        onClick={() => devolver(v, ehProjeto)}
        style={{
          padding: "8px 14px", borderRadius: 500, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: "var(--surface2)", border: "1px solid var(--border2)",
          color: ehProjeto ? "var(--danger)" : "var(--muted)",
        }}
      >
        {ehProjeto ? t("deleteProject") : t("remove")}
      </button>
    </div>
  );

  return (
    <main style={caixa}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: "0 0 6px" }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, margin: "0 0 22px" }}>
        {t("subtitle")}
      </p>

      {/* ── Música nova, do zero ── */}
      <div style={{
        border: "1px solid var(--border)", background: "var(--surface)",
        borderRadius: 12, padding: "16px 18px", marginBottom: 28,
      }}>
        {!criando ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                {t("createTitle")}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                {t("createHelp")}
              </p>
            </div>
            <button
              onClick={() => { setCriando(true); setErroNovo(null); }}
              style={{
                padding: "9px 20px", borderRadius: 500, fontSize: 14, fontWeight: 700, cursor: "pointer",
                background: "var(--accent)", color: "#000", border: "none",
              }}
            >
              + {t("createButton")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("createTitle")}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                autoFocus
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder={t("createNamePlaceholder")}
                maxLength={255}
                aria-label={t("createNameLabel")}
                style={{
                  flex: "1 1 220px", minWidth: 180, padding: "8px 11px", borderRadius: 8, fontSize: 14,
                  border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                {t("createBpm")}
                <input
                  type="number" min={30} max={300} value={novoBpm}
                  onChange={e => setNovoBpm(e.target.value)}
                  style={{
                    width: 72, padding: "8px 9px", borderRadius: 8, fontSize: 14,
                    border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                  }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                {t("createKey")}
                <input
                  value={novoTom} onChange={e => setNovoTom(e.target.value)} maxLength={10}
                  style={{
                    width: 62, padding: "8px 9px", borderRadius: 8, fontSize: 14,
                    border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                  }}
                />
              </label>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
              {t("createNote")}
            </p>
            {erroNovo && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>⚠ {erroNovo}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={criarProjeto}
                disabled={salvandoNovo}
                style={{
                  padding: "9px 20px", borderRadius: 500, fontSize: 14, fontWeight: 700,
                  cursor: salvandoNovo ? "default" : "pointer", opacity: salvandoNovo ? 0.6 : 1,
                  background: "var(--accent)", color: "#000", border: "none",
                }}
              >
                {salvandoNovo ? t("creating") : t("createConfirm")}
              </button>
              <button
                onClick={() => setCriando(false)}
                style={{
                  padding: "9px 16px", borderRadius: 500, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--muted)",
                }}
              >
                {t("createCancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Projetos ── */}
      {projetos.length > 0 && (
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 10px", textTransform: "uppercase" }}>
            {t("projectsTitle")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {projetos.map(v => linha(v, true))}
          </div>
        </section>
      )}

      {/* ── Músicas pegas do catálogo ── */}
      <section>
        {projetos.length > 0 && (
          <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 10px", textTransform: "uppercase" }}>
            {t("fromCatalogTitle")}
          </h2>
        )}
        {doCatalogo.length === 0 ? (
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
            {doCatalogo.map(v => linha(v, false))}
          </div>
        )}
      </section>
    </main>
  );
}

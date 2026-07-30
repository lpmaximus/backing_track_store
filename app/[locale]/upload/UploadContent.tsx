"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";

type Phase = "idle" | "hashing" | "uploading" | "processing" | "done" | "error";

// Ordem das 3 etapas visíveis no indicador de progresso do overlay.
// Os rótulos vêm do catálogo de mensagens (namespace "upload").
const STEP_ORDER = ["hashing", "uploading", "processing"] as const;
const PHASE_KEY: Record<Phase, string | null> = {
  idle: null,
  hashing: "phaseHashing",
  uploading: "phaseUploading",
  processing: "phaseProcessing",
  done: "phaseDone",
  error: null,
};
const STEP_KEY: Record<(typeof STEP_ORDER)[number], string> = {
  hashing: "stepHashing",
  uploading: "stepUploading",
  processing: "stepProcessing",
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** SHA-256 do arquivo (hex). Web Crypto — roda no browser, evita subir 2x. */
async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function UploadContent() {
  const t = useTranslations("upload");
  const tc = useTranslations("common");
  const { data: session, status } = useSession();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Quota de separações (quantas usadas / quantas restam no pacote).
  // trialPack = o limite é o total de um teste por convite, sem reset mensal.
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number; unlimited: boolean; trialPack?: boolean } | null>(null);

  async function loadQuota() {
    try {
      const res = await fetch("/api/upload/quota");
      if (res.ok) setQuota(await res.json());
    } catch {
      /* silencioso — a quota é informativa, não bloqueia a tela */
    }
  }

  // Carrega ao entrar (assim que houver sessão).
  useEffect(() => {
    if (session?.user) loadQuota();
  }, [session?.user]);

  // Contador de tempo por etapa — a "Separando" pode levar minutos, e sem
  // isso a tela parece travada durante a espera.
  useEffect(() => {
    const isBusy = phase === "hashing" || phase === "uploading" || phase === "processing";
    if (!isBusy) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function pollUntilReady(songId: number, slug: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/upload/status/${songId}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.processingStatus === "ready") {
        setPhase("done");
        router.push({ pathname: "/song/[slug]", params: { slug } });
        return;
      }
      if (data.processingStatus === "failed") {
        setPhase("error");
        setError(t("errFailed"));
        return;
      }
    }
    setPhase("error");
    setError(t("errTimeout"));
  }

  async function handleFile(file: File) {
    setError("");
    setFileName(file.name);

    try {
      // 1. Hash primeiro (habilita cache antes de subir).
      setPhase("hashing");
      const hash = await sha256Hex(file);

      // 2. Pede presigned URL (ou recebe cache hit).
      const prep = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "audio/mpeg", hash }),
      });
      const prepData = await prep.json();
      if (!prep.ok) {
        setPhase("error");
        setError(prepData.error ?? t("errPrepare"));
        return;
      }

      if (prepData.cached) {
        // Já existe no catálogo — vai direto.
        setPhase("done");
        router.push({ pathname: "/song/[slug]", params: { slug: prepData.slug } });
        return;
      }

      // 3. PUT direto no R2.
      setPhase("uploading");
      const put = await fetch(prepData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!put.ok) {
        setPhase("error");
        setError(t("errSend"));
        return;
      }

      // 4. Confirma → cria job → dispara separação.
      const confirm = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: prepData.key,
          publicUrl: prepData.publicUrl,
          hash,
          filename: file.name,
          contentType: file.type || "audio/mpeg",
        }),
      });
      const confirmData = await confirm.json();
      if (!confirm.ok) {
        setPhase("error");
        setError(confirmData.error ?? t("errConfirm"));
        return;
      }

      if (confirmData.cached) {
        setPhase("done");
        router.push({ pathname: "/song/[slug]", params: { slug: confirmData.slug } });
        return;
      }

      // 5. Aguarda o pipeline.
      setPhase("processing");
      await pollUntilReady(confirmData.songId, confirmData.slug);
    } catch {
      setPhase("error");
      setError(t("errUnexpected"));
    }
  }

  const busy = phase === "hashing" || phase === "uploading" || phase === "processing";
  // idle e error não têm rótulo — nesses estados a caixa mostra outro conteúdo.
  const phaseKey = PHASE_KEY[phase];
  const phaseLabel = phaseKey ? t(phaseKey) : "";

  return (
    <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px" }}>
        {t("subtitle")}
      </p>

      {status === "loading" ? null : !session?.user ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>{t("signedOut")}</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>{tc("signIn")}</Link>
        </div>
      ) : (
        <>
          {quota && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "12px 16px", marginBottom: 16,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "0 0 2px" }}>
                  {quota.trialPack ? t("quotaTitleTrial") : t("quotaTitle")}
                </p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  {quota.unlimited
                    ? t("quotaUnlimited", { used: quota.used })
                    : quota.trialPack
                      ? t("quotaUsedTrial", { used: quota.used, limit: quota.limit ?? 0, remaining: quota.remaining })
                      : t("quotaUsed", { used: quota.used, limit: quota.limit ?? 0, remaining: quota.remaining })}
                </p>
              </div>
              {!quota.unlimited && (
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <span style={{
                    fontSize: 15, fontWeight: 900,
                    color: quota.remaining === 0 ? "var(--danger)" : "var(--accent)",
                  }}>
                    {quota.remaining}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted2)", marginLeft: 4 }}>{t("remaining")}</span>
                  {/* Barrinha de progresso do consumo */}
                  <div style={{ width: 120, height: 5, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginTop: 5 }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(100, quota.limit ? (quota.used / quota.limit) * 100 : 0)}%`,
                      background: quota.remaining === 0 ? "var(--danger)" : "var(--accent)",
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            onClick={() => !busy && inputRef.current?.click()}
            style={{
              background: "var(--surface)",
              border: "2px dashed var(--border2)",
              borderRadius: 14,
              padding: "44px 24px",
              textAlign: "center",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {phase === "idle" || phase === "error" ? (
              <>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 6px" }}>
                  {t("pickFile")}
                </p>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("formats")}</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 6px" }}>{phaseLabel}</p>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</p>
              </>
            )}
          </div>

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: "16px 0 0", textAlign: "center" }}>{error}</p>
          )}
        </>
      )}

      {/* Overlay bloqueante: cobre a tela inteira (inclusive header/footer),
          com fundo desfocado, enquanto sobe/converte — assim fica claro que
          o processo está rodando, não travado, mesmo quando "Separando"
          demora vários minutos. */}
      {busy && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(250,250,250,0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
            padding: "36px 32px", maxWidth: 380, width: "100%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <div style={{
              width: 40, height: 40, margin: "0 auto 18px", borderRadius: "50%",
              border: "3px solid var(--border2)", borderTopColor: "var(--accent)",
              animation: "bts-spin 0.8s linear infinite",
            }} />

            <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", margin: "0 0 4px" }}>{phaseLabel}</p>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</p>

            {/* Indicador de etapas 1/2/3 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              {STEP_ORDER.map((step, i) => {
                const stepIdx = STEP_ORDER.indexOf(step);
                const currentIdx = STEP_ORDER.indexOf(phase as (typeof STEP_ORDER)[number]);
                const done = stepIdx < currentIdx;
                const active = stepIdx === currentIdx;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done ? "var(--accent)" : "var(--surface2)",
                        color: done ? "#fff" : active ? "var(--text)" : "var(--muted2)",
                        border: active ? "2px solid var(--accent)" : "1px solid var(--border2)",
                      }}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span style={{ fontSize: 10, color: active ? "var(--text)" : "var(--muted2)", fontWeight: active ? 700 : 400 }}>
                        {t(STEP_KEY[step])}
                      </span>
                    </div>
                    {i < STEP_ORDER.length - 1 && (
                      <span style={{ width: 28, height: 2, background: done ? "var(--accent)" : "var(--border2)", margin: "0 4px 14px" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Barra indeterminada — não temos um % real pro job assíncrono do Replicate */}
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface3)", overflow: "hidden", marginBottom: 14 }}>
              <div style={{
                height: "100%", width: "40%", borderRadius: 3,
                background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
                animation: "bts-slide 1.4s ease-in-out infinite",
              }} />
            </div>

            <p style={{ color: "var(--muted2)", fontSize: 12, margin: 0 }}>
              {phase === "processing" ? t("waitLong") : t("waitShort")}
              {" "}({formatElapsed(elapsed)})
            </p>
          </div>

          <style>{`
            @keyframes bts-spin { to { transform: rotate(360deg); } }
            @keyframes bts-slide { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
          `}</style>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Gravação do usuário sobre a música (overdub) — v1.
 *
 * Fluxo: liberar microfone → contagem → gravar ouvindo a base → revisar →
 * salvar. Depois de salvo, o take vira mais uma faixa na mesa de mixagem, com
 * M/S e volume como qualquer stem.
 *
 * ── Três decisões que definem se isso funciona ou não ────────────────────────
 *
 * 1. FONE DE OUVIDO. Sem fone, o alto-falante toca a base, o microfone captura
 *    a base junto com a pessoa, e o take sai com a música dobrada e fora de
 *    fase. Não dá para detectar isso de forma confiável no navegador, então o
 *    aviso é explícito e fica na frente do botão.
 *
 * 2. PROCESSAMENTO DE VOZ DESLIGADO. `echoCancellation`, `noiseSuppression` e
 *    `autoGainControl` existem para chamada de voz e destroem sinal musical:
 *    o cancelamento de eco corta justamente o que vaza da base, a supressão de
 *    ruído come sustain e reverb, e o ganho automático bombeia o volume no meio
 *    da frase. Todos entram como false.
 *
 * 3. LATÊNCIA. O navegador sempre atrasa entre o som entrar no microfone e ser
 *    gravado, e o atraso varia por máquina e interface. Na v1 o take nasce com
 *    offset zero e a pessoa ajusta no olho até encaixar; a calibração
 *    automática (gravar um clique de referência e medir) é v2.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Take, Transport } from "./WavePlayer";
import { FX_PRESETS, FX_DEFAULT, sanitizeFx, type FxPresetId } from "@/src/lib/takeFx";

type Props = {
  songId: number;
  takes: Take[];
  /** Recarrega a lista no pai depois de salvar, renomear, ajustar ou apagar. */
  onChange: (takes: Take[]) => void;
  transportRef: { current: Transport | null };
  /** BPM da música, quando conhecido — define o andamento da contagem. */
  bpm?: number | null;
};

type Fase = "parado" | "contando" | "gravando" | "revisando" | "salvando";

const CONTAGEM_BATIDAS = 4;
const MAX_OFFSET_MS = 2000;
const PASSOS_OFFSET = [-50, -10, 10, 50];

// Guarda a escolha de microfone entre sessões. Quem grava com interface de
// áudio usa sempre a mesma entrada; obrigar a reescolher a cada visita seria
// atrito puro. É só uma preferência de UI — nada sensível.
const CHAVE_MIC = "bts.take.micId";
const CHAVE_GANHO = "bts.take.micGain";

// 4× é o teto de propósito. Ganho digital multiplica o sinal E o ruído junto:
// acima disso o chiado sobe mais do que a voz e o take fica pior, não melhor.
// Voz baixa demais se resolve no nível de entrada do sistema/interface, não
// aqui — este controle é ajuste fino, não conserto de captação ruim.
const GANHO_MIN = 0.5;
const GANHO_MAX = 4;

/** Primeiro formato que o navegador realmente aceita. Safari só tem mp4. */
function escolherMime(): string {
  const candidatos = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidatos) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** Content-Type aceito pela rota — sem os parâmetros de codec. */
function tipoBase(mime: string): string {
  return mime.split(";")[0] || "audio/webm";
}

function formatarDuracao(s: number | null | undefined): string {
  if (!s || !isFinite(s)) return "";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

export default function TakePanel({ songId, takes, onChange, transportRef, bpm }: Props) {
  const t = useTranslations("song");

  const [fase, setFase] = useState<Fase>("parado");
  const [batida, setBatida] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [duracao, setDuracao] = useState(0);
  const [ocupado, setOcupado] = useState<number | null>(null);

  // ── Escolha do microfone ──────────────────────────────────────────────────
  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [rotulosOcultos, setRotulosOcultos] = useState(false);

  const [ganho, setGanho] = useState(1);

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const inicioRef = useRef(0);
  const cancelarRef = useRef(false);

  // Cadeia de áudio da gravação: mic → ganho → destino gravado.
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const medidorRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // O ganho muda ao vivo, no meio da gravação. Escrever direto no nó (e não
  // recriar a cadeia) é o que permite corrigir o nível sem perder o take.
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = ganho;
    localStorage.setItem(CHAVE_GANHO, String(ganho));
  }, [ganho]);

  useEffect(() => {
    const salvo = Number(localStorage.getItem(CHAVE_GANHO));
    if (Number.isFinite(salvo) && salvo >= GANHO_MIN && salvo <= GANHO_MAX) setGanho(salvo);
  }, []);

  /**
   * Medidor de nível. Escreve direto no DOM em vez de passar por estado do
   * React: são 60 leituras por segundo, e re-renderizar o painel inteiro a
   * cada uma engasgaria a gravação.
   */
  const rodarMedidor = useCallback(() => {
    const tick = () => {
      const an = analyserRef.current;
      const el = medidorRef.current;
      if (!an || !el) return;

      const buf = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(buf);
      let pico = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] - 128) / 128;
        if (v > pico) pico = v;
      }
      el.style.width = `${Math.min(100, pico * 100)}%`;
      // Vermelho perto do teto: passar disso corta o pico e distorce, e o
      // estrago não tem conserto depois de gravado.
      el.style.background = pico > 0.95 ? "var(--danger)" : "var(--accent)";
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const desmontarCadeia = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (medidorRef.current) medidorRef.current.style.width = "0%";
  }, []);

  // Solta o microfone e o objeto de preview ao desmontar. Sem isso o indicador
  // de gravação do navegador fica aceso depois que a pessoa sai da página.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(tr => tr.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      void ctxRef.current?.close().catch(() => {});
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /**
   * Lê a lista de entradas de áudio do sistema.
   *
   * O navegador só revela o NOME de cada dispositivo depois que a pessoa
   * concede acesso ao microfone uma vez — é uma proteção contra fingerprinting
   * (a lista de hardware identificaria a máquina). Antes disso vêm ids sem
   * rótulo, que não servem para escolher nada. Por isso `rotulosOcultos`: em
   * vez de mostrar "Microfone 1, Microfone 2", a interface oferece liberar o
   * acesso para poder mostrar os nomes de verdade.
   */
  const listarDispositivos = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const todos = await navigator.mediaDevices.enumerateDevices();
      const entradas = todos.filter(d => d.kind === "audioinput");
      setDispositivos(entradas);
      setRotulosOcultos(entradas.length > 0 && entradas.every(d => !d.label));

      // Se o dispositivo salvo sumiu (interface desconectada), volta ao padrão
      // do sistema em vez de insistir num id que não existe mais.
      setMicId(atual => (atual && entradas.some(d => d.deviceId === atual) ? atual : ""));
    } catch {
      // Sem lista, o fluxo segue com o microfone padrão do sistema.
    }
  }, []);

  useEffect(() => {
    const salvo = typeof window !== "undefined" ? localStorage.getItem(CHAVE_MIC) : null;
    if (salvo) setMicId(salvo);
    void listarDispositivos();

    // Plugou a interface no meio da sessão? A lista se atualiza sozinha.
    navigator.mediaDevices?.addEventListener?.("devicechange", listarDispositivos);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", listarDispositivos);
    };
  }, [listarDispositivos]);

  const escolherMic = useCallback((id: string) => {
    setMicId(id);
    if (id) localStorage.setItem(CHAVE_MIC, id);
    else localStorage.removeItem(CHAVE_MIC);
  }, []);

  /** Pede acesso só para destravar os nomes, e solta o microfone em seguida. */
  const revelarNomes = useCallback(async () => {
    setErro(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(tr => tr.stop());
      await listarDispositivos();
    } catch {
      setErro(t("takes.micDenied"));
    }
  }, [listarDispositivos, t]);

  const pararTudo = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    recRef.current = null;
    desmontarCadeia();
    transportRef.current?.pause();
  }, [transportRef, desmontarCadeia]);

  /** Clique curto da contagem, direto no Web Audio — não depende de arquivo. */
  const tocarClique = useCallback((agudo: boolean) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = agudo ? 1600 : 1000;
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      setTimeout(() => void ctx.close(), 200);
    } catch {
      // Clique é conforto, não requisito — se o navegador recusar, a contagem
      // visual sozinha já orienta a entrada.
    }
  }, []);

  const gravar = useCallback(async () => {
    setErro(null);
    cancelarRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // `exact` de propósito: se a interface escolhida foi desconectada, é
          // melhor falhar com aviso do que o navegador cair silenciosamente no
          // microfone do notebook. O músico só descobriria depois de gravar a
          // música inteira — e com o som errado.
          ...(micId ? { deviceId: { exact: micId } } : {}),
        },
      });
    } catch (e) {
      const semDispositivo =
        e instanceof DOMException &&
        (e.name === "OverconstrainedError" || e.name === "NotFoundError");
      setErro(semDispositivo ? t("takes.micGone") : t("takes.micDenied"));
      if (semDispositivo) void listarDispositivos();
      return;
    }
    streamRef.current = stream;
    // Depois do primeiro acesso os nomes existem — atualiza a lista para que o
    // seletor pare de mostrar entradas anônimas.
    if (rotulosOcultos) void listarDispositivos();

    // ── Cadeia de áudio: mic → ganho → o que vai ser gravado ────────────────
    // O MediaRecorder grava o stream que recebe, então o ganho precisa estar
    // ANTES dele. Aplicar volume depois só mudaria a reprodução; o arquivo
    // continuaria fraco, e é o arquivo que a pessoa baixa e leva embora.
    //
    // Nada é ligado em `ctx.destination` de propósito: devolver o microfone
    // para a saída daria realimentação no alto-falante e, no fone, a pessoa se
    // ouviria com o atraso do navegador — o suficiente para desafinar.
    const Ctx = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = ganho;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const dest = ctx.createMediaStreamDestination();
    src.connect(gain);
    gain.connect(analyser);
    gain.connect(dest);

    ctxRef.current = ctx;
    gainRef.current = gain;
    analyserRef.current = analyser;
    // Medidor já na contagem: são quatro batidas para ver se o nível está bom
    // ANTES de gastar uma tomada inteira descobrindo que ficou baixo.
    rodarMedidor();

    const mime = escolherMime();
    if (!mime) {
      pararTudo();
      setErro(t("takes.unsupported"));
      return;
    }

    // ── Contagem ────────────────────────────────────────────────────────────
    // Entra depois de liberar o microfone, não antes: pedir permissão no meio
    // da contagem atrasaria a entrada e estragaria a primeira gravação.
    setFase("contando");
    const intervalo = Math.max(250, Math.min(1500, 60000 / (bpm && bpm > 0 ? bpm : 100)));

    for (let i = 0; i < CONTAGEM_BATIDAS; i++) {
      if (cancelarRef.current) { pararTudo(); setFase("parado"); return; }
      setBatida(CONTAGEM_BATIDAS - i);
      tocarClique(i === 0);
      await new Promise(r => setTimeout(r, intervalo));
    }
    setBatida(0);
    if (cancelarRef.current) { pararTudo(); setFase("parado"); return; }

    // ── Base e microfone partem juntos ──────────────────────────────────────
    // Grava o stream que saiu da cadeia com ganho, não o do microfone cru.
    const rec = new MediaRecorder(dest.stream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: tipoBase(mime) });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setDuracao((performance.now() - inicioRef.current) / 1000);
      setNome(t("takes.defaultName"));
      setFase("revisando");
    };
    recRef.current = rec;

    transportRef.current?.seek(0);
    rec.start();
    inicioRef.current = performance.now();
    await transportRef.current?.play();
    setFase("gravando");
  }, [bpm, ganho, micId, rotulosOcultos, listarDispositivos, pararTudo, rodarMedidor, t, tocarClique, transportRef]);

  const parar = useCallback(() => {
    cancelarRef.current = true;
    try { recRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    desmontarCadeia();
    transportRef.current?.pause();
  }, [transportRef, desmontarCadeia]);

  const descartar = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setFase("parado");
  }, [previewUrl]);

  const recarregar = useCallback(async () => {
    const res = await fetch(`/api/takes?songId=${songId}`);
    if (res.ok) {
      const data = (await res.json()) as { takes: Take[] };
      onChange(data.takes);
    }
  }, [songId, onChange]);

  const salvar = useCallback(async () => {
    if (!blob) return;
    setFase("salvando");
    setErro(null);
    try {
      // 1. permissão de escrita para uma key controlada pelo servidor
      const pres = await fetch("/api/takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "presign", songId, contentType: blob.type }),
      });
      if (!pres.ok) throw new Error((await pres.json()).error ?? "presign");
      const { uploadUrl, publicUrl } = (await pres.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      // 2. o áudio vai direto do navegador para o R2, sem passar pela rota
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!put.ok) throw new Error("upload");

      // 3. só agora existe linha no banco — se o upload falhar, não fica take
      //    fantasma apontando para um arquivo que nunca chegou
      const com = await fetch("/api/takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "commit",
          songId,
          publicUrl,
          name: nome,
          durationSec: duracao,
        }),
      });
      if (!com.ok) throw new Error((await com.json()).error ?? "commit");

      descartar();
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error && e.message !== "upload" ? e.message : t("takes.saveError"));
      setFase("revisando");
    }
  }, [blob, songId, nome, duracao, descartar, recarregar, t]);

  const ajustar = useCallback(
    async (take: Take, delta: number) => {
      const novo = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, take.offsetMs + delta));
      if (novo === take.offsetMs) return;

      // Atualiza a tela antes da rede: o ajuste fino é usado aos cliques até
      // encaixar, e esperar a resposta a cada clique tornaria o controle
      // inutilizável. O player reage na hora; o banco alcança depois.
      onChange(takes.map(x => (x.id === take.id ? { ...x, offsetMs: novo } : x)));
      setOcupado(take.id);
      try {
        await fetch(`/api/takes/${take.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offsetMs: novo }),
        });
      } finally {
        setOcupado(null);
      }
    },
    [takes, onChange],
  );

  const apagar = useCallback(
    async (take: Take) => {
      if (!confirm(t("takes.confirmDelete", { name: take.name }))) return;
      setOcupado(take.id);
      try {
        const res = await fetch(`/api/takes/${take.id}`, { method: "DELETE" });
        if (res.ok) onChange(takes.filter(x => x.id !== take.id));
      } finally {
        setOcupado(null);
      }
    },
    [takes, onChange, t],
  );

  /**
   * Troca o efeito da gravação.
   *
   * A tela muda na hora e a rede alcança depois: escolher efeito é comparar
   * ("com hall / sem hall / mais hall"), e esperar resposta a cada clique
   * mataria a comparação. O efeito é de reprodução — o arquivo gravado
   * continua limpo, então errar aqui não custa nada.
   */
  const mudarFx = useCallback(
    async (take: Take, patch: { preset?: FxPresetId; mix?: number }) => {
      const atual = sanitizeFx(take.fx ?? FX_DEFAULT);
      const novo = sanitizeFx({ ...atual, ...patch });
      onChange(takes.map(x => (x.id === take.id ? { ...x, fx: novo } : x)));
      await fetch(`/api/takes/${take.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fx: novo }),
      });
    },
    [takes, onChange],
  );

  const renomear = useCallback(
    async (take: Take, novo: string) => {
      const limpo = novo.trim().slice(0, 120);
      if (!limpo || limpo === take.name) return;
      onChange(takes.map(x => (x.id === take.id ? { ...x, name: limpo } : x)));
      await fetch(`/api/takes/${take.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: limpo }),
      });
    },
    [takes, onChange],
  );

  const caixa: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
    marginTop: 16,
  };

  const botao: React.CSSProperties = {
    padding: "9px 18px",
    borderRadius: 500,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid var(--border2)",
    background: "var(--surface2)",
    color: "var(--text)",
  };

  return (
    <div style={caixa}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">🎙️</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {t("takes.title")}
        </h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        {t("takes.headphones")}
      </p>

      {erro && (
        <p role="alert" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--danger)" }}>
          {erro}
        </p>
      )}

      {/* Seletor de entrada. Some durante a gravação: trocar de microfone no
          meio não faz sentido e o controle só distrairia. */}
      {(fase === "parado" || fase === "revisando") && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <label htmlFor="mic-take" style={{ fontSize: 12, color: "var(--muted)" }}>
            {t("takes.micLabel")}
          </label>
          <select
            id="mic-take"
            value={micId}
            onChange={e => escolherMic(e.target.value)}
            style={{
              flex: "1 1 220px", minWidth: 180, maxWidth: 380, padding: "7px 10px",
              borderRadius: 8, fontSize: 13, border: "1px solid var(--border2)",
              background: "var(--surface2)", color: "var(--text)",
            }}
          >
            <option value="">{t("takes.micDefault")}</option>
            {dispositivos.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || t("takes.micUnnamed", { n: i + 1 })}
              </option>
            ))}
          </select>
          {rotulosOcultos && (
            <button onClick={revelarNomes} style={{ ...botao, padding: "6px 12px", fontSize: 12 }}>
              {t("takes.micReveal")}
            </button>
          )}
        </div>
      )}

      {/* Ganho de entrada + medidor. O medidor só tem sinal com o microfone
          aberto (contagem e gravação); fora disso a barra fica zerada, e é
          justo — não há o que medir. */}
      {fase !== "salvando" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <label htmlFor="ganho-take" style={{ fontSize: 12, color: "var(--muted)" }}>
            {t("takes.gainLabel")}
          </label>
          <input
            id="ganho-take"
            type="range"
            min={GANHO_MIN}
            max={GANHO_MAX}
            step={0.1}
            value={ganho}
            onChange={e => setGanho(Number(e.target.value))}
            style={{ width: 130 }}
          />
          <span style={{ fontSize: 12, color: "var(--muted2)", minWidth: 34 }}>
            {ganho.toFixed(1)}×
          </span>
          <div
            aria-hidden="true"
            style={{
              flex: "1 1 120px", minWidth: 100, height: 8, borderRadius: 500,
              background: "var(--surface2)", border: "1px solid var(--border2)", overflow: "hidden",
            }}
          >
            <div ref={medidorRef} style={{ width: "0%", height: "100%", background: "var(--accent)", transition: "width 0.06s linear" }} />
          </div>
        </div>
      )}

      {fase === "parado" && (
        <p style={{ margin: "-8px 0 14px", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
          {t("takes.gainHelp")}
        </p>
      )}

      {rotulosOcultos && fase === "parado" && (
        <p style={{ margin: "-6px 0 14px", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
          {t("takes.micRevealHelp")}
        </p>
      )}

      {fase === "parado" && (
        <button onClick={gravar} style={{ ...botao, background: "var(--accent)", color: "#000", border: "none" }}>
          {t("takes.record")}
        </button>
      )}

      {fase === "contando" && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: "var(--accent)", minWidth: 34 }}>
            {batida}
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("takes.getReady")}</span>
          <button onClick={parar} style={botao}>{t("takes.cancel")}</button>
        </div>
      )}

      {fase === "gravando" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--danger)", display: "inline-block" }} />
          <span style={{ fontSize: 13, color: "var(--text)" }}>{t("takes.recording")}</span>
          <button onClick={parar} style={{ ...botao, marginLeft: "auto" }}>{t("takes.stop")}</button>
        </div>
      )}

      {(fase === "revisando" || fase === "salvando") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {previewUrl && <audio src={previewUrl} controls style={{ width: "100%" }} />}
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            maxLength={120}
            aria-label={t("takes.nameLabel")}
            style={{
              padding: "9px 12px", borderRadius: 8, fontSize: 14,
              border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={salvar}
              disabled={fase === "salvando"}
              style={{ ...botao, background: "var(--accent)", color: "#000", border: "none", opacity: fase === "salvando" ? 0.6 : 1 }}
            >
              {fase === "salvando" ? t("takes.saving") : t("takes.save")}
            </button>
            <button onClick={descartar} disabled={fase === "salvando"} style={botao}>
              {t("takes.discard")}
            </button>
          </div>
        </div>
      )}

      {takes.length > 0 && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {takes.map(take => (
            <div
              key={take.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "8px 0", opacity: ocupado === take.id ? 0.5 : 1,
              }}
            >
              <input
                defaultValue={take.name}
                onBlur={e => renomear(take, e.target.value)}
                maxLength={120}
                aria-label={t("takes.nameLabel")}
                style={{
                  flex: "1 1 140px", minWidth: 120, padding: "6px 9px", borderRadius: 6, fontSize: 13,
                  border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                }}
              />
              <span style={{ fontSize: 12, color: "var(--muted2)", minWidth: 34 }}>
                {formatarDuracao(Number((take as Take & { durationSec?: string }).durationSec))}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {PASSOS_OFFSET.map(p => (
                  <button
                    key={p}
                    onClick={() => ajustar(take, p)}
                    title={t("takes.nudgeHint")}
                    style={{ ...botao, padding: "4px 7px", fontSize: 11, fontWeight: 600, borderRadius: 6 }}
                  >
                    {p > 0 ? `+${p}` : p}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 56, textAlign: "right" }}>
                  {take.offsetMs} ms
                </span>
              </div>

              <button
                onClick={() => apagar(take)}
                style={{ ...botao, padding: "4px 10px", fontSize: 12, color: "var(--danger)" }}
              >
                {t("takes.delete")}
              </button>

              {/* Efeito da gravação. Ocupa a linha inteira porque, com o
                  seletor e a intensidade na mesma linha dos outros controles,
                  a fileira quebra feio em tela estreita. */}
              <div style={{
                flexBasis: "100%", display: "flex", alignItems: "center", gap: 8,
                flexWrap: "wrap", paddingTop: 2,
              }}>
                <label htmlFor={`fx-${take.id}`} style={{ fontSize: 12, color: "var(--muted)" }}>
                  {t("takes.fxLabel")}
                </label>
                <select
                  id={`fx-${take.id}`}
                  value={sanitizeFx(take.fx ?? FX_DEFAULT).preset}
                  onChange={e => mudarFx(take, { preset: e.target.value as FxPresetId })}
                  style={{
                    padding: "5px 9px", borderRadius: 6, fontSize: 12,
                    border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                  }}
                >
                  {FX_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {t(`takes.fx.${p.id}`)}
                    </option>
                  ))}
                </select>

                {sanitizeFx(take.fx ?? FX_DEFAULT).preset !== "none" && (
                  <>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={sanitizeFx(take.fx ?? FX_DEFAULT).mix}
                      onChange={e => mudarFx(take, { mix: Number(e.target.value) })}
                      aria-label={t("takes.fxAmount")}
                      style={{ width: 110 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted2)", minWidth: 32 }}>
                      {Math.round(sanitizeFx(take.fx ?? FX_DEFAULT).mix * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
            {t("takes.offsetHelp")}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
            {t("takes.fxHelp")}
          </p>
        </div>
      )}
    </div>
  );
}

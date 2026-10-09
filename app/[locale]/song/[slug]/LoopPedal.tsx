"use client";

/**
 * Pedal de loop — a janela com o pedal desenhado (EVT-005).
 *
 * ── Por que um pop-up com cara de pedal, e não mais uma fileira de botões ────
 * Quem usa isto está com as duas mãos ocupadas e olhando para o instrumento,
 * não para a tela. Um pedal desenhado resolve dois problemas de uma vez: quem
 * já tem um sabe usar sem ler nada, e quem não tem entende o que a função faz
 * só de olhar. A janela também isola o teclado — com ela aberta, espaço é o
 * interruptor e mais nada, o que seria impossível numa barra de controles
 * dividindo a página com o player.
 *
 * ── O que este pedal NÃO faz ────────────────────────────────────────────────
 * Não salva. Fechar a janela apaga o loop, e isso é escolha, não limitação:
 * sem arquivo não há upload, não há armazenamento e não há gravação de voz de
 * ninguém parada num servidor. É o que permite a função existir em todo plano
 * pago em vez de ficar presa ao tier que vende gravação (EVT-005 §7).
 *
 * Também não amarra o loop ao andamento da música. O pedal de verdade é livre:
 * o comprimento é o que o pé marcou. Quantizar ao BPM mudaria a natureza da
 * ferramenta e não foi o que se pediu.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  aoPisarPrincipal, aoPisarParar, rotuloPrincipal, podeDesfazer,
  acaoDaTecla, aprenderTecla, sanitizeKeymap, codigoUtilizavel,
  KEYMAP_PADRAO, PEDAL_PRESETS, sanitizeLatenciaMs,
  LATENCIA_MIN_MS, LATENCIA_MAX_MS,
  type LooperState, type PedalKeymap,
} from "@/src/lib/looper";
import { LooperEngine, MAX_SEGUNDOS, type LooperSnapshot } from "./looperEngine";

const CHAVE_KEYMAP = "bts.looper.keymap";
const CHAVE_LATENCIA = "bts.looper.latencyMs";
const CHAVE_MIC = "bts.take.micId"; // mesma preferência da gravação de take

const RAIO_ANEL = 54;
const VOLTA = 2 * Math.PI * RAIO_ANEL;

/** Tempo até um toque virar "segurar", e janela do toque duplo. */
const MS_SEGURAR = 900;
const MS_DUPLO = 350;

const COR: Record<LooperState, string> = {
  idle: "#3a1113",
  recording: "#ff2d2d",
  playing: "#25d366",
  overdubbing: "#ff9a00",
  stopped: "#7a2a2c",
};

export default function LoopPedal() {
  const t = useTranslations("song");
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        padding: "16px 18px", marginTop: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }} aria-hidden="true">🔁</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {t("looper.title")}
          </h3>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {t("looper.pitch")}
        </p>
        <button
          onClick={() => setAberto(true)}
          style={{
            padding: "9px 18px", borderRadius: 500, fontSize: 14, fontWeight: 700,
            cursor: "pointer", border: "none", background: "var(--accent)", color: "#000",
          }}
        >
          {t("looper.open")}
        </button>
      </div>

      {aberto && <Janela onFechar={() => setAberto(false)} />}
    </>
  );
}

// ─── Janela ──────────────────────────────────────────────────────────────────

function Janela({ onFechar }: { onFechar: () => void }) {
  const t = useTranslations("song");

  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const [ligado, setLigado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<LooperState>("idle");
  const [temUndo, setTemUndo] = useState(false);
  const [comprimento, setComprimento] = useState(0);

  const [nivel, setNivel] = useState(1);
  const [ganho, setGanho] = useState(1);
  const [monitor, setMonitor] = useState(false);
  const [latencia, setLatencia] = useState(30);

  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState("");

  const [keymap, setKeymap] = useState<PedalKeymap>(KEYMAP_PADRAO);
  const [aprendendo, setAprendendo] = useState<"primary" | "stop" | null>(null);
  const [ajustes, setAjustes] = useState(false);

  const motorRef = useRef<LooperEngine | null>(null);
  const anelRef = useRef<SVGCircleElement | null>(null);
  const medidorRef = useRef<HTMLDivElement | null>(null);
  const tempoRef = useRef<HTMLSpanElement | null>(null);
  // Espelhos do estado para os manipuladores de evento: eles são registrados
  // uma vez no `window` e leriam para sempre o valor do primeiro render se
  // dependessem do estado direto.
  const estadoRef = useRef<LooperState>("idle");
  const undoRef = useRef(false);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { undoRef.current = temUndo; }, [temUndo]);

  // ── Preferências ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const km = localStorage.getItem(CHAVE_KEYMAP);
      if (km) setKeymap(sanitizeKeymap(JSON.parse(km)));
      const lat = localStorage.getItem(CHAVE_LATENCIA);
      if (lat) setLatencia(sanitizeLatenciaMs(lat));
      const mic = localStorage.getItem(CHAVE_MIC);
      if (mic) setMicId(mic);
    } catch {
      // Preferência ilegível não pode impedir o pedal de abrir.
    }
    navigator.mediaDevices?.enumerateDevices?.()
      .then(l => setDispositivos(l.filter(d => d.kind === "audioinput")))
      .catch(() => {});
  }, []);

  const guardarKeymap = useCallback((km: PedalKeymap) => {
    setKeymap(km);
    try { localStorage.setItem(CHAVE_KEYMAP, JSON.stringify(km)); } catch {}
  }, []);

  // ── Motor ─────────────────────────────────────────────────────────────────
  const ligar = useCallback(async () => {
    setErro(null);
    const motor = new LooperEngine();
    try {
      await motor.iniciar({
        deviceId: micId || undefined,
        onState: (s: LooperSnapshot) => {
          setEstado(s.state);
          setTemUndo(s.canUndo);
          setComprimento(s.lengthSec);
        },
        // Anel, medidor e cronômetro escrevem direto no DOM: são dezenas de
        // atualizações por segundo, e passar isso por estado do React
        // re-renderizaria a janela inteira a cada quadro — o bastante para o
        // áudio engasgar na mesma thread.
        onTick: ({ pos, recSec, peak }) => {
          if (anelRef.current) {
            anelRef.current.style.strokeDashoffset = String(VOLTA * (1 - pos));
          }
          if (medidorRef.current) {
            medidorRef.current.style.width = `${Math.min(100, peak * 100)}%`;
            medidorRef.current.style.background = peak > 0.95 ? "var(--danger)" : "var(--accent)";
          }
          if (tempoRef.current && recSec > 0) {
            tempoRef.current.textContent = `${recSec.toFixed(1)}s`;
          }
        },
        onFull: () => setErro(t("looper.full", { s: MAX_SEGUNDOS })),
      });
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(
        e instanceof Error && e.message === "worklet" ? t("looper.unsupported")
        : nome === "OverconstrainedError" || nome === "NotFoundError" ? t("looper.micGone")
        : t("looper.micDenied"),
      );
      return;
    }
    motor.setLatenciaMs(latencia);
    motor.setNivel(nivel);
    motorRef.current = motor;
    setLigado(true);

    // Os nomes das entradas só existem depois do primeiro acesso concedido —
    // antes disso o navegador esconde a lista de hardware. Agora dá para
    // mostrar "Interface Focusrite" em vez de "Microfone 2".
    navigator.mediaDevices?.enumerateDevices?.()
      .then(l => setDispositivos(l.filter(d => d.kind === "audioinput")))
      .catch(() => {});
  }, [micId, latencia, nivel, t]);

  useEffect(() => {
    return () => { motorRef.current?.parar(); motorRef.current = null; };
  }, []);

  useEffect(() => { motorRef.current?.setLatenciaMs(latencia); }, [latencia]);
  useEffect(() => { motorRef.current?.setNivel(nivel); }, [nivel]);
  useEffect(() => { motorRef.current?.setGanhoEntrada(ganho); }, [ganho]);
  useEffect(() => { motorRef.current?.setMonitor(monitor); }, [monitor]);

  // ── Interruptores ─────────────────────────────────────────────────────────
  const principal = useCallback(() => {
    const motor = motorRef.current;
    if (!motor) return;
    const { cmd, next } = aoPisarPrincipal(estadoRef.current);
    motor.enviar(cmd);
    setEstado(next);
    estadoRef.current = next;
  }, []);

  const desfazer = useCallback(() => {
    if (!podeDesfazer(estadoRef.current, undoRef.current)) return;
    motorRef.current?.enviar("undo");
  }, []);

  const parar = useCallback(() => {
    const motor = motorRef.current;
    if (!motor) return;
    const r = aoPisarParar(estadoRef.current);
    if (!r) return;
    motor.enviar(r.cmd);
    setEstado(r.next);
    estadoRef.current = r.next;
  }, []);

  const apagar = useCallback(() => {
    motorRef.current?.enviar("clear");
    setEstado("idle");
    estadoRef.current = "idle";
    setComprimento(0);
    setTemUndo(false);
    if (anelRef.current) anelRef.current.style.strokeDashoffset = String(VOLTA);
    if (tempoRef.current) tempoRef.current.textContent = "";
  }, []);

  // Toque, toque duplo e segurar — um gesto por vez, sem esperar para decidir.
  //
  // O comando principal dispara NA HORA. Adiar 350 ms para saber se vem um
  // segundo toque deixaria o pedal atrasado justamente onde ele precisa ser
  // exato. Se o segundo toque vier, o desfazer entra por cima — e "voltei a
  // tocar e desfiz" é uma sequência que faz sentido de ouvir.
  const seguraRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const ultimoRef = useRef<Record<string, number>>({});
  const seguradoRef = useRef<Record<string, boolean>>({});
  const pressoRef = useRef<Record<string, boolean>>({});

  const inicioToque = useCallback((qual: "primary" | "stop") => {
    if (!motorRef.current) return;
    seguradoRef.current[qual] = false;
    pressoRef.current[qual] = true;
    if (qual === "stop") {
      seguraRef.current.stop = setTimeout(() => {
        seguradoRef.current.stop = true;
        apagar();
      }, MS_SEGURAR);
    }
  }, [apagar]);

  const fimToque = useCallback((qual: "primary" | "stop") => {
    // Sem o par correspondente, o soltar não é um toque: acontece quando a
    // tecla foi apertada com o foco num campo, ou quando o ponteiro entrou na
    // área já pressionado. Agir aqui gravaria sem ninguém ter pisado.
    if (!motorRef.current || !pressoRef.current[qual]) return;
    pressoRef.current[qual] = false;
    const timer = seguraRef.current[qual];
    if (timer) { clearTimeout(timer); seguraRef.current[qual] = null; }
    if (seguradoRef.current[qual]) { seguradoRef.current[qual] = false; return; }

    const agora = Date.now();
    const duplo = agora - (ultimoRef.current[qual] ?? 0) < MS_DUPLO;
    ultimoRef.current[qual] = agora;

    if (qual === "primary") {
      if (duplo) desfazer();
      else principal();
    } else {
      parar();
    }
  }, [desfazer, principal, parar]);

  // ── Teclado e pedal físico ────────────────────────────────────────────────
  //
  // O pedal por Bluetooth chega ao navegador como TECLADO — pisar nele manda
  // uma tecla. Por isso não há pareamento aqui: o que existe é ensinar qual
  // tecla cada interruptor escuta, o que funciona com qualquer modelo, dos
  // que já existem aos que ainda vão sair.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (aprendendo) {
        e.preventDefault();
        if (e.code === "Escape") { setAprendendo(null); return; }
        if (!codigoUtilizavel(e.code)) return;
        guardarKeymap(aprenderTecla(keymap, aprendendo, e.code));
        setAprendendo(null);
        return;
      }

      if (e.code === "Escape") { onFechar(); return; }

      // Enquanto o foco está num campo de texto ou num controle, a tecla é da
      // pessoa escrevendo, não do pedal.
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;

      const acao = acaoDaTecla(keymap, e.code);
      if (!acao) return;
      e.preventDefault();
      inicioToque(acao);
    };

    const up = (e: KeyboardEvent) => {
      if (aprendendo) return;
      const acao = acaoDaTecla(keymap, e.code);
      if (!acao) return;
      e.preventDefault();
      fimToque(acao);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [keymap, aprendendo, guardarKeymap, inicioToque, fimToque, onFechar]);

  if (!montado) return null;

  const rotulo = rotuloPrincipal(estado);
  const cor = COR[estado];
  const aceso = estado === "recording" || estado === "playing" || estado === "overdubbing";

  const botaoAjuste: React.CSSProperties = {
    padding: "5px 11px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("looper.title")}
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        padding: "18px 20px 22px", width: "min(560px, 100%)", maxHeight: "94vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
            {t("looper.title")}
          </h2>
          <button
            onClick={onFechar}
            aria-label={t("looper.close")}
            style={{ ...botaoAjuste, marginLeft: "auto", padding: "5px 10px" }}
          >
            ✕
          </button>
        </div>

        {erro && (
          <p role="alert" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--danger)" }}>
            {erro}
          </p>
        )}

        {/* ── O pedal ── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 300, borderRadius: 14, padding: "16px 16px 20px",
            background: "linear-gradient(175deg,#d8332f 0%,#b8231f 46%,#8f1714 100%)",
            border: "1px solid #6d100e",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 10px 26px rgba(0,0,0,0.4)",
            position: "relative", userSelect: "none",
          }}>
            {/* Parafusos — o detalhe que faz o desenho ler como equipamento
                e não como cartão de interface. */}
            {[[10, 10], [278, 10], [10, 300], [278, 300]].map(([x, y], i) => (
              <span key={i} aria-hidden="true" style={{
                position: "absolute", left: x, top: y, width: 10, height: 10, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%,#e9e9e9,#8b8b8b 60%,#5c5c5c)",
                boxShadow: "inset 0 0 2px rgba(0,0,0,0.6)",
              }} />
            ))}

            <div style={{
              textAlign: "center", color: "#ffe9c9", fontSize: 10, fontWeight: 800,
              letterSpacing: "0.22em", marginBottom: 10,
            }}>
              BTS LOOPER · LP-1
            </div>

            {/* Anel de posição + luz central */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ position: "relative", width: 128, height: 128 }}>
                <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
                  <circle cx="64" cy="64" r={RAIO_ANEL} fill="none" stroke="rgba(0,0,0,0.34)" strokeWidth="7" />
                  <circle
                    ref={anelRef}
                    cx="64" cy="64" r={RAIO_ANEL} fill="none"
                    stroke={aceso ? cor : "transparent"} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={VOLTA} strokeDashoffset={VOLTA}
                    transform="rotate(-90 64 64)"
                    style={{ filter: aceso ? `drop-shadow(0 0 5px ${cor})` : "none" }}
                  />
                </svg>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3,
                }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: "50%", background: cor,
                    boxShadow: aceso ? `0 0 12px ${cor}` : "inset 0 0 4px rgba(0,0,0,0.7)",
                    animation: estado === "recording" ? "btsLoopPulse 1s infinite" : undefined,
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#ffe9c9" }}>
                    {t(`looper.state.${estado}`)}
                  </span>
                  <span ref={tempoRef} style={{ fontSize: 11, color: "#ffd9a8", fontVariantNumeric: "tabular-nums" }}>
                    {comprimento > 0 ? `${comprimento.toFixed(1)}s` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de nível — gira arrastando, como o de verdade. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              <Knob valor={nivel} onChange={setNivel} rotulo={t("looper.level")} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", color: "#ffe9c9" }}>
                {t("looper.level").toUpperCase()}
              </span>
            </div>

            {/* Interruptores */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
              <Switch
                aria-label={t(`looper.sw.${rotulo}`)}
                disabled={!ligado}
                titulo={t(`looper.sw.${rotulo}`)}
                sub={t("looper.swUndo")}
                destaque={estado === "recording" || estado === "overdubbing"}
                onDown={() => inicioToque("primary")}
                onUp={() => fimToque("primary")}
              />
              <Switch
                aria-label={t("looper.sw.stop")}
                disabled={!ligado}
                titulo={t("looper.sw.stop")}
                sub={t("looper.swClear")}
                onDown={() => inicioToque("stop")}
                onUp={() => fimToque("stop")}
              />
            </div>
          </div>
        </div>

        {/* Ligar o microfone é um gesto explícito: o navegador precisa do
            clique para liberar o áudio, e ninguém deve ter o microfone aberto
            só por ter espiado a janela. */}
        {!ligado && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={() => void ligar()}
              style={{
                padding: "10px 22px", borderRadius: 500, fontSize: 14, fontWeight: 700,
                cursor: "pointer", border: "none", background: "var(--accent)", color: "#000",
              }}
            >
              {t("looper.arm")}
            </button>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
              {t("looper.headphones")}
            </p>
          </div>
        )}

        {ligado && (
          <>
            {/* Medidor de entrada */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("looper.input")}</span>
              <div aria-hidden="true" style={{
                flex: 1, height: 8, borderRadius: 500, background: "var(--surface2)",
                border: "1px solid var(--border2)", overflow: "hidden",
              }}>
                <div ref={medidorRef} style={{ width: "0%", height: "100%", background: "var(--accent)", transition: "width 0.06s linear" }} />
              </div>
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.7 }}>
              {t("looper.help", {
                primary: legivel(keymap.primary[0]),
                stop: keymap.stop[0] ? legivel(keymap.stop[0]) : "—",
              })}
            </p>

            <button onClick={() => setAjustes(v => !v)} style={{ ...botaoAjuste, marginTop: 12 }}>
              {ajustes ? t("looper.hideSettings") : t("looper.showSettings")}
            </button>
          </>
        )}

        {ligado && ajustes && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Entrada */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label htmlFor="looper-mic" style={{ fontSize: 12, color: "var(--muted)" }}>{t("looper.micLabel")}</label>
              <select
                id="looper-mic"
                value={micId}
                onChange={e => {
                  const v = e.target.value;
                  setMicId(v);
                  try { v ? localStorage.setItem(CHAVE_MIC, v) : localStorage.removeItem(CHAVE_MIC); } catch {}
                }}
                style={{
                  flex: "1 1 200px", minWidth: 160, padding: "6px 9px", borderRadius: 8, fontSize: 12,
                  border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                }}
              >
                <option value="">{t("looper.micDefault")}</option>
                {dispositivos.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>{d.label || `#${i + 1}`}</option>
                ))}
              </select>
            </div>
            <p style={{ margin: "-8px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
              {t("looper.micSwitchHelp")}
            </p>

            {/* Ganho de entrada */}
            <Linha rotulo={t("looper.gain")} valor={`${ganho.toFixed(1)}×`}>
              <input type="range" min={0.5} max={4} step={0.1} value={ganho}
                onChange={e => setGanho(Number(e.target.value))} style={{ width: 140 }} />
            </Linha>

            {/* Latência */}
            <div>
              <Linha rotulo={t("looper.latency")} valor={`${latencia} ms`}>
                <input
                  type="range" min={LATENCIA_MIN_MS} max={LATENCIA_MAX_MS} step={1} value={latencia}
                  onChange={e => {
                    const v = sanitizeLatenciaMs(e.target.value);
                    setLatencia(v);
                    try { localStorage.setItem(CHAVE_LATENCIA, String(v)); } catch {}
                  }}
                  style={{ width: 140 }}
                />
                <button
                  onClick={() => {
                    // Palpite do navegador. Cobre só o caminho interno dele —
                    // o atraso do microfone e da interface nenhum navegador
                    // informa. Por isso existe o controle ao lado.
                    const v = motorRef.current?.latenciaSugeridaMs() ?? 30;
                    setLatencia(v);
                    try { localStorage.setItem(CHAVE_LATENCIA, String(v)); } catch {}
                  }}
                  style={botaoAjuste}
                >
                  {t("looper.latencyAuto")}
                </button>
              </Linha>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
                {t("looper.latencyHelp")}
              </p>
            </div>

            {/* Monitoração */}
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
                <input type="checkbox" checked={monitor} onChange={e => setMonitor(e.target.checked)} />
                {t("looper.monitor")}
              </label>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
                {t("looper.monitorHelp")}
              </p>
            </div>

            {/* Pedal físico */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <h4 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {t("looper.pedalTitle")}
              </h4>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
                {t("looper.pedalHelp")}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["primary", "stop"] as const).map(alvo => (
                  <div key={alvo} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 108 }}>
                      {t(`looper.pedalSwitch.${alvo}`)}
                    </span>
                    <code style={{
                      fontSize: 12, padding: "3px 9px", borderRadius: 6, background: "var(--surface2)",
                      border: "1px solid var(--border2)", color: "var(--text)", minWidth: 74, textAlign: "center",
                    }}>
                      {keymap[alvo][0] ? legivel(keymap[alvo][0]) : "—"}
                    </code>
                    <button onClick={() => setAprendendo(alvo)} style={botaoAjuste}>
                      {aprendendo === alvo ? t("looper.learning") : t("looper.learn")}
                    </button>
                  </div>
                ))}
              </div>

              {aprendendo && (
                <p role="status" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                  {t("looper.learnPrompt")}
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("looper.presets")}</span>
                {PEDAL_PRESETS.map(p => (
                  <button key={p.id} onClick={() => guardarKeymap(p.keymap)} style={botaoAjuste}>
                    {t(`looper.preset.${p.id}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p style={{ margin: "16px 0 0", fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
          {t("looper.ephemeral")}
        </p>
      </div>

      <style>{`@keyframes btsLoopPulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>,
    document.body,
  );
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function Linha({ rotulo, valor, children }: { rotulo: string; valor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 108 }}>{rotulo}</span>
      {children}
      <span style={{ fontSize: 12, color: "var(--muted2)", minWidth: 48 }}>{valor}</span>
    </div>
  );
}

/**
 * Interruptor de pé.
 *
 * `onPointerDown`/`onPointerUp` em vez de `onClick` porque segurar e tocar duas
 * vezes são gestos distintos aqui, e `click` só avisa quando já acabou.
 * `touch-action: none` impede o navegador de tratar o toque como rolagem no
 * celular — o pedal ficaria surdo ao gesto mais importante dele.
 */
function Switch({
  titulo, sub, disabled, destaque, onDown, onUp, ...rest
}: {
  titulo: string; sub: string; disabled?: boolean; destaque?: boolean;
  onDown: () => void; onUp: () => void;
} & React.AriaAttributes) {
  const [preso, setPreso] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <button
        {...rest}
        type="button"
        disabled={disabled}
        onPointerDown={e => { e.preventDefault(); if (disabled) return; setPreso(true); onDown(); }}
        onPointerUp={() => { if (disabled) return; setPreso(false); onUp(); }}
        onPointerLeave={() => { if (preso) { setPreso(false); onUp(); } }}
        style={{
          width: 104, height: 60, borderRadius: 10, cursor: disabled ? "default" : "pointer",
          border: "1px solid #4a4a4a", touchAction: "none",
          background: preso
            ? "linear-gradient(180deg,#8e8e8e,#c9c9c9)"
            : "linear-gradient(180deg,#e2e2e2 0%,#b4b4b4 52%,#8e8e8e 100%)",
          boxShadow: preso
            ? "inset 0 3px 7px rgba(0,0,0,0.45)"
            : "0 3px 0 #6f6f6f, 0 5px 10px rgba(0,0,0,0.35)",
          transform: preso ? "translateY(2px)" : "none",
          opacity: disabled ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", color: "#1a1a1a",
        }}
      >
        {titulo.toUpperCase()}
      </button>
      <span style={{
        fontSize: 9, letterSpacing: "0.08em", color: destaque ? "#fff3df" : "#ffd9a8", opacity: 0.9,
      }}>
        {sub}
      </span>
    </div>
  );
}

/** Botão giratório: arrasta para cima aumenta, para baixo diminui. */
function Knob({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) {
  const arrastando = useRef<{ y: number; v: number } | null>(null);

  useEffect(() => {
    const mover = (e: PointerEvent) => {
      const d = arrastando.current;
      if (!d) return;
      // 160 px de curso para o giro inteiro: menos que isso faz o valor pular,
      // mais faz parecer que o botão não responde.
      onChange(Math.max(0, Math.min(1.5, d.v + (d.y - e.clientY) / 160)));
    };
    const soltar = () => { arrastando.current = null; };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
  }, [onChange]);

  const angulo = -140 + (valor / 1.5) * 280;

  return (
    <div
      role="slider"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={150}
      aria-valuenow={Math.round(valor * 100)}
      tabIndex={0}
      onPointerDown={e => { e.preventDefault(); arrastando.current = { y: e.clientY, v: valor }; }}
      onKeyDown={e => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(Math.min(1.5, valor + 0.05)); }
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(Math.max(0, valor - 0.05)); }
      }}
      style={{
        width: 46, height: 46, borderRadius: "50%", cursor: "ns-resize", touchAction: "none",
        background: "radial-gradient(circle at 34% 28%,#4a4a4a,#1c1c1c 62%,#0d0d0d)",
        border: "1px solid #000", boxShadow: "0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)",
        position: "relative",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", left: "50%", top: 5, width: 2.5, height: 15, borderRadius: 2,
        background: "#ffe9c9", transformOrigin: "50% 18px",
        transform: `translateX(-50%) rotate(${angulo}deg)`,
      }} />
    </div>
  );
}

/**
 * "KeyS" e "ArrowUp" não dizem nada a quem só quer saber onde apertar.
 * Sem tradução de propósito: o que sai daqui é o nome gravado na tecla, e a
 * tecla é a mesma nos dois idiomas.
 */
function legivel(code: string | undefined): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return { Up: "↑", Down: "↓", Left: "←", Right: "→" }[code.slice(5)] ?? code;
  return code;
}

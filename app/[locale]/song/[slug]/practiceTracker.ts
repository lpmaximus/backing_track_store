"use client";

/**
 * Medidor de "prática significativa" (PRD-BTS-001 v3.0 §3 e §4).
 *
 * Prática significativa = pelo menos 180 s de reprodução EFETIVA (áudio
 * andando com a aba visível; pausa e aba em segundo plano não somam) + pelo
 * menos uma interação musical na mesma sessão (mixer, velocidade, tom, rolagem
 * da cifra, gravação). É o evento que define ativação e retenção do piloto.
 *
 * Divisão de trabalho:
 *  - aqui (navegador) só se MEDE: acumula segundos efetivos e conta interações,
 *    e manda `practice_progress` de tempos em tempos;
 *  - o servidor (/api/activity) é quem DECIDE e grava `practice_qualified`, uma
 *    vez por sessão. Assim a regra (180 s + 1 interação) fica num lugar só e
 *    pode mudar sem novo deploy do cliente.
 *
 * Sessão = uma abertura do player. Recarregar a página abre outra sessão.
 * Usuário anônimo não gera linha (o servidor responde 204), então o medidor
 * roda para todo mundo sem custo.
 */
import { useCallback, useEffect, useRef } from "react";
import { track } from "@/app/track";

/** Mesmo valor do servidor; aqui só serve para mandar o aviso na hora certa. */
const QUALIFY_SECONDS = 180;
/** Intervalo entre avisos de progresso, em segundos efetivos. */
const PROGRESS_EVERY_S = 60;
const PROGRESS_AFTER_QUALIFIED_S = 300;
/** Um salto de relógio maior que isso entre dois ticks não é reprodução contínua. */
const MAX_TICK_GAP_S = 2.5;

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function usePracticeTracker(songId: number) {
  const st = useRef({
    sid: "",
    effective: 0,
    interactions: 0,
    lastTime: -1,
    lastWall: 0,
    sentEffective: 0,
    qualifiedSent: false,
  });

  const send = useCallback(() => {
    const s = st.current;
    if (!s.sid) s.sid = newSessionId();
    s.sentEffective = s.effective;
    track("practice_progress", {
      songId,
      once: false,
      meta: { sid: s.sid, effectiveS: Math.round(s.effective), interactions: s.interactions },
    });
  }, [songId]);

  const maybeSend = useCallback(() => {
    const s = st.current;
    if (!s.qualifiedSent && s.effective >= QUALIFY_SECONDS && s.interactions >= 1) {
      s.qualifiedSent = true;
      send();
      return;
    }
    const every = s.qualifiedSent ? PROGRESS_AFTER_QUALIFIED_S : PROGRESS_EVERY_S;
    if (s.effective - s.sentEffective >= every) send();
  }, [send]);

  /** Chamar a cada atualização de tempo do player. */
  const onTime = useCallback((time: number) => {
    const s = st.current;
    const now = performance.now();
    if (
      s.lastTime >= 0 &&
      time !== s.lastTime &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      const dt = (now - s.lastWall) / 1000;
      if (dt > 0 && dt < MAX_TICK_GAP_S) s.effective += dt;
    }
    s.lastTime = time;
    s.lastWall = now;
    maybeSend();
  }, [maybeSend]);

  /** Chamar quando a pessoa mexe em algo musical (mixer, tom, velocidade…). */
  const onInteraction = useCallback(() => {
    st.current.interactions += 1;
    maybeSend();
  }, [maybeSend]);

  // Ao sair da página, manda o que sobrou (keepalive no track()).
  useEffect(() => {
    const flush = () => {
      const s = st.current;
      if (s.effective - s.sentEffective >= 10) send();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [send]);

  return { onTime, onInteraction };
}

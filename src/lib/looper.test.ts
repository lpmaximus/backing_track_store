import { describe, it, expect } from "vitest";
import {
  aoPisarPrincipal, aoPisarParar, podeDesfazer, rotuloPrincipal,
  acaoDaTecla, aprenderTecla, sanitizeKeymap, codigoUtilizavel,
  sanitizeLatenciaMs, latenciaEstimadaMs,
  KEYMAP_PADRAO, type LooperState,
} from "./looper";
import { can, roleCan } from "./permissions";

// O pedal é acionado com o pé, no meio de uma música, por quem não está
// olhando para a tela. Um erro aqui não aparece como tela quebrada: aparece
// como uma tomada perdida no ensaio. Daí o cuidado com estes casos.

describe("ciclo do interruptor principal", () => {
  it("segue a ordem do pedal: gravar → tocar → sobrepor → tocar", () => {
    expect(aoPisarPrincipal("idle")).toEqual({ cmd: "rec", next: "recording" });
    expect(aoPisarPrincipal("recording")).toEqual({ cmd: "close", next: "playing" });
    expect(aoPisarPrincipal("playing")).toEqual({ cmd: "overdub", next: "overdubbing" });
    expect(aoPisarPrincipal("overdubbing")).toEqual({ cmd: "play", next: "playing" });
  });

  it("com o loop parado, pisar volta a tocar — não regrava por cima", () => {
    // Se isto virasse "rec", um toque distraído apagaria o loop inteiro sem
    // aviso, que é o pior desfecho possível para o gesto mais usado.
    expect(aoPisarPrincipal("stopped")).toEqual({ cmd: "play", next: "playing" });
  });

  it("nunca sai do ciclo, qualquer que seja o estado", () => {
    const estados: LooperState[] = ["idle", "recording", "playing", "overdubbing", "stopped"];
    for (const e of estados) {
      const r = aoPisarPrincipal(e);
      expect(r.cmd, `estado ${e} não devolveu comando`).toBeTruthy();
      expect(estados).toContain(r.next);
    }
  });
});

describe("interruptor de parada", () => {
  it("parar durante a gravação FECHA o loop em vez de descartar", () => {
    // Perder a tomada por um toque errado seria imperdoável; apagar exige o
    // gesto deliberado de segurar.
    expect(aoPisarParar("recording")).toEqual({ cmd: "stop", next: "stopped" });
  });

  it("não faz nada sem loop, nem com o loop já parado", () => {
    expect(aoPisarParar("idle")).toBeNull();
    expect(aoPisarParar("stopped")).toBeNull();
  });
});

describe("desfazer", () => {
  it("só quando existe camada guardada e já há loop", () => {
    expect(podeDesfazer("playing", true)).toBe(true);
    expect(podeDesfazer("overdubbing", true)).toBe(true);
    expect(podeDesfazer("playing", false)).toBe(false);
    expect(podeDesfazer("idle", true)).toBe(false);
    expect(podeDesfazer("recording", true)).toBe(false);
  });
});

describe("rótulo do interruptor", () => {
  it("anuncia o que o PRÓXIMO toque faz, não o estado atual", () => {
    expect(rotuloPrincipal("idle")).toBe("rec");
    expect(rotuloPrincipal("recording")).toBe("play");
    expect(rotuloPrincipal("playing")).toBe("dub");
    expect(rotuloPrincipal("overdubbing")).toBe("play");
    expect(rotuloPrincipal("stopped")).toBe("play");
  });
});

describe("teclas do pedal físico", () => {
  it("reconhece a tecla mapeada e ignora as outras", () => {
    expect(acaoDaTecla(KEYMAP_PADRAO, "Space")).toBe("primary");
    expect(acaoDaTecla(KEYMAP_PADRAO, "KeyS")).toBe("stop");
    expect(acaoDaTecla(KEYMAP_PADRAO, "KeyQ")).toBeNull();
  });

  it("aprender uma tecla a retira do outro interruptor", () => {
    // A mesma tecla nos dois faria o pedal gravar e parar no mesmo toque —
    // defeito que só apareceria em cima da hora.
    const km = aprenderTecla(KEYMAP_PADRAO, "stop", "Space");
    expect(km.stop).toEqual(["Space"]);
    expect(km.primary).not.toContain("Space");
  });

  it("recusa teclas que a própria janela precisa", () => {
    expect(codigoUtilizavel("Escape")).toBe(false);
    expect(codigoUtilizavel("Tab")).toBe(false);
    expect(codigoUtilizavel("ArrowUp")).toBe(true);
    expect(codigoUtilizavel("")).toBe(false);
    expect(codigoUtilizavel(42)).toBe(false);
    expect(aprenderTecla(KEYMAP_PADRAO, "primary", "Escape")).toEqual(KEYMAP_PADRAO);
  });

  it("mapa estragado volta ao padrão em vez de deixar o pedal mudo", () => {
    expect(sanitizeKeymap(null).primary).toEqual(KEYMAP_PADRAO.primary);
    expect(sanitizeKeymap({ primary: [] }).primary).toEqual(KEYMAP_PADRAO.primary);
    expect(sanitizeKeymap({ primary: ["Escape", "KeyA"] }).primary).toEqual(["KeyA"]);
    expect(sanitizeKeymap({ primary: ["KeyA", "KeyA"] }).primary).toEqual(["KeyA"]);
  });

  it("parar pode ficar sem tecla — há o botão na tela", () => {
    expect(sanitizeKeymap({ primary: ["KeyA"], stop: [] }).stop).toEqual([]);
  });
});

describe("latência", () => {
  it("mantém o valor dentro da faixa útil", () => {
    expect(sanitizeLatenciaMs(45)).toBe(45);
    expect(sanitizeLatenciaMs(-10)).toBe(0);
    expect(sanitizeLatenciaMs(9999)).toBe(300);
    expect(sanitizeLatenciaMs("abc")).toBe(30);
  });

  it("navegador que declara zero recebe um piso, não zero", () => {
    // Zero não significa instantâneo, significa que ele não sabe — e aceitar
    // zero deixaria toda sobreposição atrasada sem explicação na tela.
    expect(latenciaEstimadaMs({ baseLatency: 0, outputLatency: 0 })).toBeGreaterThanOrEqual(20);
    expect(latenciaEstimadaMs({})).toBeGreaterThanOrEqual(20);
    expect(latenciaEstimadaMs({ baseLatency: 0.01, outputLatency: 0.02 })).toBe(30);
  });
});

// ─── Gating (EVT-005 §7) ─────────────────────────────────────────────────────
// A decisão foi tratar o pedal como capacidade PRÓPRIA, e não como uma
// reabertura de `record_take`. A diferença é real: aqui não sai arquivo, não
// há upload e não fica gravação de voz de ninguém num servidor. Estes testes
// existem para que a distinção não se perca numa refatoração distraída.

describe("pedal de loop no RBAC", () => {
  it("está aberto a todo plano pago", () => {
    expect(can("pro", "loop_pedal")).toBe(true);
    expect(can("proband", "loop_pedal")).toBe(true);
    expect(can("studio", "loop_pedal")).toBe(true);
    expect(can("admin", "loop_pedal")).toBe(true);
  });

  it("continua fechado para quem não paga", () => {
    expect(can("free", "loop_pedal")).toBe(false);
    expect(can("freeband", "loop_pedal")).toBe(false);
    expect(roleCan(null, "loop_pedal")).toBe(false);
  });

  it("não arrasta a gravação de take junto", () => {
    // Se este teste falhar, alguém liberou gravação COM arquivo para o Pro
    // achando que estava mexendo só no pedal.
    expect(can("pro", "record_take")).toBe(false);
    expect(can("proband", "record_take")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { computePreloadActions, maxWindowSize } from "./stagePreload";

describe("computePreloadActions", () => {
  it("no início, carrega a atual e a próxima (janela padrão ahead=1)", () => {
    const r = computePreloadActions(new Set(), 0, 5);
    expect(r.toLoad).toEqual([0, 1]);
    expect(r.toDispose).toEqual([]);
    expect(r.window).toEqual([0, 1]);
  });

  it("ao avançar uma música, carrega a N+1 e descarta a N-1 (comportamento exato da ADR)", () => {
    // Estado após tocar a música 0: {0, 1} carregadas.
    const afterSong0 = new Set([0, 1]);
    const r = computePreloadActions(afterSong0, 1, 5);
    expect(r.toLoad).toEqual([2]);
    expect(r.toDispose).toEqual([0]);
    expect(r.window).toEqual([1, 2]);
  });

  it("avançando do início ao fim, nunca mantém mais que 2 músicas carregadas", () => {
    const total = 8;
    let loaded = new Set<number>();
    let peak = 0;
    for (let i = 0; i < total; i++) {
      const r = computePreloadActions(loaded, i, total);
      for (const l of r.toLoad) loaded.add(l);
      for (const d of r.toDispose) loaded.delete(d);
      peak = Math.max(peak, loaded.size);
    }
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBe(maxWindowSize(total));
  });

  it("na última música, não tenta carregar uma N+1 que não existe", () => {
    const total = 5;
    const loaded = new Set([3, 4]);
    const r = computePreloadActions(loaded, 4, total);
    expect(r.toLoad).toEqual([]);
    expect(r.toDispose).toEqual([3]);
    expect(r.window).toEqual([4]);
  });

  it("setlist de 1 música: janela é só ela mesma, nada a descartar", () => {
    const r = computePreloadActions(new Set([0]), 0, 1);
    expect(r.toLoad).toEqual([]);
    expect(r.toDispose).toEqual([]);
    expect(r.window).toEqual([0]);
  });

  it("pulo manual para trás (ex.: usuário toca 'anterior' voltando 3 músicas) recompõe a janela do zero", () => {
    // Estava tocando a música 5 com {5,6} carregadas; usuário volta pra música 1.
    const loaded = new Set([5, 6]);
    const r = computePreloadActions(loaded, 1, 10);
    expect(r.toLoad.sort()).toEqual([1, 2]);
    expect(r.toDispose.sort()).toEqual([5, 6]);
  });

  it("pulo manual para frente descarta tudo que ficou para trás da nova janela", () => {
    const loaded = new Set([0, 1]);
    const r = computePreloadActions(loaded, 7, 10);
    expect(r.toLoad.sort()).toEqual([7, 8]);
    expect(r.toDispose.sort()).toEqual([0, 1]);
  });

  it("índice fora dos limites descarta tudo e não carrega nada (defesa; o motor não deveria chegar aqui)", () => {
    const r = computePreloadActions(new Set([0, 1]), -1, 5);
    expect(r.toLoad).toEqual([]);
    expect(r.toDispose).toEqual([0, 1]);
  });

  it("setlist vazio (total=0) não carrega nada", () => {
    const r = computePreloadActions(new Set(), 0, 0);
    expect(r.toLoad).toEqual([]);
    expect(r.window).toEqual([]);
  });

  it("behind=1 mantém a música anterior em memória em vez de descartar (opção configurável)", () => {
    const loaded = new Set([0, 1]);
    const r = computePreloadActions(loaded, 1, 5, { behind: 1 });
    expect(r.toDispose).toEqual([]); // 0 permanece: está dentro da janela [0,2]
    expect(r.toLoad).toEqual([2]);
    expect(r.window).toEqual([0, 1, 2]);
  });

  it("chamar duas vezes seguidas com o mesmo índice é idempotente (nada a fazer na segunda vez)", () => {
    const loaded = new Set([2, 3]);
    const r = computePreloadActions(loaded, 2, 5);
    expect(r.toLoad).toEqual([]);
    expect(r.toDispose).toEqual([]);
  });
});

describe("maxWindowSize", () => {
  it("com ahead=1 e behind=0 (padrão), o pico é 2 — nunca o setlist inteiro", () => {
    expect(maxWindowSize(20)).toBe(2);
  });

  it("nunca excede o total de músicas do setlist", () => {
    expect(maxWindowSize(1)).toBe(1);
  });
});

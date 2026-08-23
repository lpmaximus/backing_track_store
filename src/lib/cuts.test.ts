/**
 * Testes da normalização de cortes.
 *
 * Este módulo é lido por três lados que precisam concordar — a rota que valida,
 * o player que silencia e o render que grava o corte no arquivo. Quando os três
 * discordam, o sintoma é sempre o mesmo e sempre confuso: "some na tela e volta
 * no download". Os testes aqui existem para prender esse contrato.
 */
import { describe, it, expect } from "vitest";
import { normalizeCuts, sanitizeTrackCuts, totalCortado, dentroDeCorte, takeIdDaChave } from "./cuts";

describe("normalizeCuts", () => {
  it("ordena e funde trechos que se tocam", () => {
    expect(normalizeCuts([
      { start: 10, end: 12 },
      { start: 2, end: 4 },
      { start: 11, end: 15 },
    ])).toEqual([
      { start: 2, end: 4 },
      { start: 10, end: 15 },
    ]);
  });

  it("cortar duas vezes o mesmo trecho não duplica", () => {
    const um = normalizeCuts([{ start: 5, end: 8 }]);
    expect(normalizeCuts([...um, { start: 5, end: 8 }])).toEqual([{ start: 5, end: 8 }]);
  });

  it("descarta trecho curto demais, invertido ou não numérico", () => {
    expect(normalizeCuts([
      { start: 3, end: 3.01 },              // menor que o mínimo
      { start: 9, end: 4 },                 // invertido
      { start: "a", end: 2 },               // lixo
      null,
    ])).toEqual([]);
  });

  it("não aceita valor negativo nem além do teto de sanidade", () => {
    const [c] = normalizeCuts([{ start: -50, end: 3 }]);
    expect(c.start).toBe(0);
    expect(normalizeCuts([{ start: 0, end: 999_999 }])[0].end).toBe(4 * 60 * 60);
  });

  it("respeita a duração quando ela é informada", () => {
    expect(normalizeCuts([{ start: 100, end: 200 }], 120)).toEqual([{ start: 100, end: 120 }]);
  });

  it("não é array vira lista vazia", () => {
    expect(normalizeCuts("x")).toEqual([]);
    expect(normalizeCuts(undefined)).toEqual([]);
  });
});

describe("sanitizeTrackCuts", () => {
  const chaves = new Set(["drums", "bass", "take:7", "mix"]);

  it("mantém só as faixas que existem", () => {
    const out = sanitizeTrackCuts(
      {
        drums: [{ start: 1, end: 2 }],
        piano: [{ start: 1, end: 2 }],   // instrumento que a música não tem
        "take:99": [{ start: 1, end: 2 }], // gravação de outra pessoa
      },
      chaves,
    );
    expect(Object.keys(out)).toEqual(["drums"]);
  });

  it("faixa sem corte válido não ocupa espaço no mapa", () => {
    const out = sanitizeTrackCuts({ bass: [], mix: [{ start: 4, end: 4 }] }, chaves);
    expect(out).toEqual({});
  });

  it("entrada que não é objeto vira mapa vazio", () => {
    expect(sanitizeTrackCuts([{ start: 1, end: 2 }], chaves)).toEqual({});
    expect(sanitizeTrackCuts(null, chaves)).toEqual({});
  });
});

describe("auxiliares", () => {
  it("soma o tempo apagado", () => {
    expect(totalCortado([{ start: 1, end: 3 }, { start: 10, end: 12.5 }])).toBeCloseTo(4.5);
  });

  it("o fim do corte já está fora dele — senão o silêncio comeria a nota seguinte", () => {
    const cortes = [{ start: 2, end: 4 }];
    expect(dentroDeCorte(cortes, 2)).toBe(true);
    expect(dentroDeCorte(cortes, 3.9)).toBe(true);
    expect(dentroDeCorte(cortes, 4)).toBe(false);
  });

  it("reconhece a chave de gravação", () => {
    expect(takeIdDaChave("take:12")).toBe(12);
    expect(takeIdDaChave("drums")).toBeNull();
    expect(takeIdDaChave("take:abc")).toBeNull();
  });
});

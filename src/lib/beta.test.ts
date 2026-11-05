import { afterEach, describe, expect, it } from "vitest";
import { can, grantedOnlyByBeta } from "./permissions";
import { betaLimits, betaTakeCap, freeMonthlyLimit, isBetaFullAccess } from "./beta";

// Não importar quota.ts (puxa o Neon no carregamento — ver roles.test.ts).
// freeMonthlyLimit é exatamente o que quota.monthlyLimitForRole usa para o Free.
const FREE_MONTHLY_UPLOAD_LIMIT = 3;
const monthlyLimitForRole = (role: string) => (role === "pro" ? 20 : freeMonthlyLimit(FREE_MONTHLY_UPLOAD_LIMIT));

/**
 * Open Beta (PRD-BTS-001 §7). O que importa garantir: com a flag desligada a
 * matriz de planos volta EXATAMENTE ao que era; com a flag ligada o Free ganha
 * o que o piloto testa — e nada do que ficou de fora de propósito.
 */
const KEYS = ["BETA_FULL_ACCESS", "NEXT_PUBLIC_BETA_FULL_ACCESS", "BETA_SEPARATIONS_PER_MONTH"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("Open Beta desligado", () => {
  it("não libera nada além da matriz de planos", () => {
    delete process.env.BETA_FULL_ACCESS;
    delete process.env.NEXT_PUBLIC_BETA_FULL_ACCESS;
    expect(isBetaFullAccess()).toBe(false);
    expect(can("free", "record_take")).toBe(false);
    expect(can("pro", "record_take")).toBe(false);
    expect(can("free", "loop_pedal")).toBe(false);
    expect(can("free", "create_setlist")).toBe(false);
    expect(monthlyLimitForRole("free")).toBe(FREE_MONTHLY_UPLOAD_LIMIT);
  });
});

describe("Open Beta ligado", () => {
  it("libera gravação, pedal, setlist e comentário para o Free", () => {
    process.env.BETA_FULL_ACCESS = "true";
    for (const a of ["record_take", "loop_pedal", "create_setlist", "comment_publication"] as const) {
      expect(can("free", a)).toBe(true);
      expect(grantedOnlyByBeta("free", a)).toBe(true);
    }
    expect(can("pro", "record_take")).toBe(true);
    expect(grantedOnlyByBeta("studio", "record_take")).toBe(false);
  });

  it("mantém fechado o que ficou fora do piloto", () => {
    process.env.NEXT_PUBLIC_BETA_FULL_ACCESS = "true";
    expect(can("free", "view_shared_catalog")).toBe(false);
    expect(can("free", "create_band")).toBe(false);
    expect(can("free", "guitar_tab")).toBe(false);
    expect(can("free", "copy_song")).toBe(false);
  });

  it("sobe a cota do Free para o pacote do piloto, sem baixar de 3", () => {
    process.env.BETA_FULL_ACCESS = "true";
    expect(monthlyLimitForRole("free")).toBe(5);
    process.env.BETA_SEPARATIONS_PER_MONTH = "8";
    expect(monthlyLimitForRole("free")).toBe(8);
    process.env.BETA_SEPARATIONS_PER_MONTH = "1";
    expect(monthlyLimitForRole("free")).toBe(FREE_MONTHLY_UPLOAD_LIMIT);
    expect(monthlyLimitForRole("pro")).toBe(20);
  });

  it("teto de takes: Studio não tem teto do Beta; Free e Pro têm", () => {
    expect(betaTakeCap("studio")).toBeNull();
    expect(betaTakeCap("admin")).toBeNull();
    expect(betaTakeCap("free")).toEqual(betaLimits().takes.free);
    expect(betaTakeCap("pro")).toEqual(betaLimits().takes.pro);
  });
});

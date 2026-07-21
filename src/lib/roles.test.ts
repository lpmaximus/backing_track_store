import { describe, it, expect } from "vitest";
import { isProRole, decideProAccess } from "./roles";

// Testa a lógica de decisão de acesso Pro — a parte de segurança do passo 2b.
// Não toca o banco (por isso vive em roles.ts, não em access.ts).

describe("isProRole", () => {
  it("concede para pro, proband e admin", () => {
    expect(isProRole("pro")).toBe(true);
    expect(isProRole("proband")).toBe(true);
    expect(isProRole("admin")).toBe(true);
  });

  it("nega para free, indefinido e valores estranhos", () => {
    expect(isProRole("free")).toBe(false);
    expect(isProRole(undefined)).toBe(false);
    expect(isProRole(null)).toBe(false);
    expect(isProRole("Pro")).toBe(false); // case-sensitive de propósito
  });
});

describe("decideProAccess", () => {
  it("role individual pro/admin concede, independente de banda", () => {
    expect(decideProAccess({ role: "pro", hasActiveBandAccess: false })).toBe(true);
    expect(decideProAccess({ role: "admin", hasActiveBandAccess: false })).toBe(true);
  });

  it("membro de banda com assinatura ativa concede mesmo sendo free", () => {
    expect(decideProAccess({ role: "free", hasActiveBandAccess: true })).toBe(true);
    expect(decideProAccess({ role: undefined, hasActiveBandAccess: true })).toBe(true);
  });

  it("free sem banda ativa é negado", () => {
    expect(decideProAccess({ role: "free", hasActiveBandAccess: false })).toBe(false);
    expect(decideProAccess({ role: undefined, hasActiveBandAccess: false })).toBe(false);
  });
});

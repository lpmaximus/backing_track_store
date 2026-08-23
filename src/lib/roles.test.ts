import { describe, it, expect } from "vitest";
import { isProRole, decideProAccess, roleLabel } from "./roles";
import { can, roleCan, resolveUserType } from "./permissions";

// NÃO importar quota.ts aqui: ele importa @/src/db, e src/db/index.ts chama
// neon(process.env.DATABASE_URL!) já no carregamento do módulo — sem a env o
// import explode e derruba o arquivo de teste inteiro. Mesma razão pela qual
// decideProAccess vive em roles.ts e não em access.ts. A cota do studio é
// conferida no type-check e na revisão, não aqui.

// Testa a lógica de decisão de acesso Pro — a parte de segurança do passo 2b.
// Não toca o banco (por isso vive em roles.ts, não em access.ts).

describe("isProRole", () => {
  it("concede para pro, proband, studio e admin", () => {
    expect(isProRole("pro")).toBe(true);
    expect(isProRole("proband")).toBe(true);
    expect(isProRole("studio")).toBe(true);
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

// ─── BTS-Studio (EVT-004) ────────────────────────────────────────────────────
// O risco de introduzir um tier é silencioso: alguém adiciona o role, esquece
// de um Set na matriz, e o assinante mais caro do produto perde uma capacidade
// que o plano abaixo tem. Estes testes existem para que isso quebre no CI.

describe("tier studio", () => {
  it("é reconhecido como tipo próprio, não cai no free", () => {
    expect(resolveUserType("studio")).toBe("studio");
    expect(roleLabel("studio")).toBe("STUDIO");
  });

  it("herda TODA capacidade do proband — nunca menos", () => {
    const acoes = [
      "comment_publication",
      "comment_band_setlist",
      "create_setlist",
      "create_band",
      "view_shared_catalog",
    ] as const;

    for (const acao of acoes) {
      expect(can("proband", acao), `proband deveria poder ${acao}`).toBe(true);
      expect(can("studio", acao), `studio perdeu ${acao} que o proband tem`).toBe(true);
    }
  });

  it("as capacidades exclusivas são exclusivas mesmo", () => {
    expect(can("studio", "guitar_tab")).toBe(true);
    expect(can("studio", "record_take")).toBe(true);

    // Se estes virarem true sem uma decisão de produto, o tier deixou de ter
    // o que vender.
    expect(can("proband", "guitar_tab")).toBe(false);
    expect(can("pro", "guitar_tab")).toBe(false);
    expect(can("free", "guitar_tab")).toBe(false);
    expect(can("proband", "record_take")).toBe(false);
  });

  it("admin continua sendo supraconjunto do studio", () => {
    expect(can("admin", "guitar_tab")).toBe(true);
    expect(can("admin", "record_take")).toBe(true);
  });

  it("roleCan aceita a string crua vinda da sessão", () => {
    expect(roleCan("studio", "guitar_tab")).toBe(true);
    expect(roleCan("proband", "guitar_tab")).toBe(false);
  });
});

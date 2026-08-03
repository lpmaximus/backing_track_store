/**
 * Contas de teste interno (ADR informal 2026-08-03).
 *
 * O admin (role "admin") já é excluído da analytics em qualquer lugar do site
 * — mas a conta usada para TESTAR como usuário comum (lpmax.geek@gmail.com)
 * precisa continuar com role normal (free/pro) para o teste fazer sentido, e
 * por isso não cai na exclusão por role. Esta lista resolve isso por e-mail.
 *
 * Fica em env var (não no código) por dois motivos: some do bundle do client
 * — só um booleano (`isInternalTester`) trafega até o navegador, nunca o
 * e-mail em si — e dá pra ajustar quem é conta de teste sem tocar em código.
 *
 * INTERNAL_TEST_EMAILS="l2techs.ia@gmail.com,lpmax.geek@gmail.com"
 */
function list(): string[] {
  return (process.env.INTERNAL_TEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalTestEmail(email?: string | null): boolean {
  if (!email) return false;
  return list().includes(email.trim().toLowerCase());
}

/** Para uso em queries (drizzle notInArray) — undefined quando a lista está vazia, pra não gerar `NOT IN ()`. */
export function internalTestEmailsOrUndefined(): string[] | undefined {
  const l = list();
  return l.length > 0 ? l : undefined;
}

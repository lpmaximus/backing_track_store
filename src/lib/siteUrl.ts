/** URL pública canônica do site, sem barra no final.
 *
 *  Ordem de precedência:
 *  1. PUBLIC_BASE_URL   — override explícito (mesma var já usada em /api/upload/confirm)
 *  2. NEXTAUTH_URL      — já configurada em produção para o callback de login
 *  3. VERCEL_URL        — preview deploys da Vercel (vem sem protocolo)
 *  4. domínio de produção como último recurso
 */
export function siteUrl(): string {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://backingtrack.store";

  return raw.replace(/\/+$/, "");
}

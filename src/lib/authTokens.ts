/**
 * Tokens assinados (HMAC) para recuperar senha e para o login por link de
 * e-mail — SEM tabela no banco.
 *
 * Por que sem tabela: evita migração pendente (db:push) só para isso, e os dois
 * casos têm uma forma natural de invalidar o token:
 *
 * - Recuperar senha: a assinatura inclui o hash da senha ATUAL. Trocou a senha,
 *   o hash muda e qualquer link antigo deixa de valer — vira uso único na prática.
 * - Link de acesso: validade curta (20 min). Não é uso único; aceito para o beta
 *   (quem tem o link tem acesso ao e-mail, que é exatamente o que ele prova).
 *
 * Segredo: AUTH_SECRET (NextAuth v5) ou NEXTAUTH_SECRET (nome usado no .env).
 */
import crypto from "crypto";

const RESET_TTL_MS = 60 * 60 * 1000;      // 1 h
const MAGIC_TTL_MS = 20 * 60 * 1000;      // 20 min

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET não configurado");
  return s;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function unb64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(purpose: string, payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`${purpose}|${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// ── Recuperar senha ─────────────────────────────────────────────────────────

export function createResetToken(userId: number, passwordHash: string | null): string {
  const exp = Date.now() + RESET_TTL_MS;
  const sig = sign("reset", `${userId}.${exp}.${passwordHash ?? "-"}`);
  return `${userId}.${exp}.${sig}`;
}

/** Só decodifica (sem validar) — o caller busca o usuário e chama verifyResetToken. */
export function parseResetToken(token: string): { userId: number; exp: number; sig: string } | null {
  const [id, exp, sig] = token.split(".");
  const userId = Number(id);
  const expN = Number(exp);
  if (!Number.isInteger(userId) || !Number.isFinite(expN) || !sig) return null;
  return { userId, exp: expN, sig };
}

export function verifyResetToken(token: string, passwordHash: string | null): boolean {
  const p = parseResetToken(token);
  if (!p || p.exp < Date.now()) return false;
  const expected = sign("reset", `${p.userId}.${p.exp}.${passwordHash ?? "-"}`);
  return safeEqual(p.sig, expected);
}

// ── Link de acesso por e-mail ───────────────────────────────────────────────

export function createMagicToken(email: string): string {
  const e = email.trim().toLowerCase();
  const exp = Date.now() + MAGIC_TTL_MS;
  return `${b64url(e)}.${exp}.${sign("magic", `${e}.${exp}`)}`;
}

/** Devolve o e-mail (minúsculo) se o token for válido e não tiver vencido. */
export function verifyMagicToken(token: string): string | null {
  const [e64, exp, sig] = token.split(".");
  if (!e64 || !exp || !sig) return null;
  const expN = Number(exp);
  if (!Number.isFinite(expN) || expN < Date.now()) return null;
  let email: string;
  try { email = unb64url(e64); } catch { return null; }
  return safeEqual(sig, sign("magic", `${email}.${expN}`)) ? email : null;
}

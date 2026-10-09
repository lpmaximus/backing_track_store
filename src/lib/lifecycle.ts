/**
 * E-mails de ciclo de vida — o canal que traz o usuário de volta ao site.
 *
 * Diagnóstico que motivou (admin, 09/10/2026): 4 cadastros novos na semana e
 * nenhum retorno. A caixa de mensagens da Área do Usuário só é lida por quem
 * VOLTA ao site, então não servia para trazer ninguém de volta. E 12 de 13
 * contas Free nunca usaram uma separação — o diferencial do produto.
 *
 * Sequência (uma vez por pessoa, idempotente via lifecycle_emails):
 *   welcome       D0  na hora do cadastro (+ repescagem no cron)
 *   nudge_upload  D2  só se ainda não separou nenhuma música
 *   week_one      D7  texto muda se já separou ou não
 * Transacionais (sem trava de unicidade, ignoram descadastro):
 *   song_ready        a separação terminou — a pessoa costuma fechar a aba
 *                     durante os minutos de espera
 * Manual:
 *   broadcast         aviso do /admin/mensagens com "também por e-mail"
 *
 * Tudo aqui é best-effort: falha de SMTP ou migração 0015 pendente NUNCA
 * derruba cadastro, webhook ou cron — só loga.
 *
 * Runtime Node (nodemailer). Toca o banco — não importar em client/edge.
 */
import crypto from "crypto";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { and, eq, gte, lt, ne, isNull, sql, notInArray } from "drizzle-orm";
import { db, users, songs, lifecycleEmails, userEmailPrefs } from "@/src/db";
import { sendMail, mailerConfigured } from "@/src/lib/mailer";
import { siteUrl } from "@/src/lib/siteUrl";
import { localizePath } from "@/src/i18n/localizePath";
import { PT_COUNTRIES, LOCALE_COOKIE } from "@/src/i18n/geo";
import { internalTestEmailsOrUndefined, isInternalTestEmail } from "@/src/lib/internalTest";

export type Lang = "pt" | "en";
export type LifecycleKind = "welcome" | "nudge_upload" | "week_one";

const DAY = 86_400_000;
const SENDER = process.env.LIFECYCLE_SENDER_NAME || process.env.INVITE_SENDER_NAME || "Luiz Paulo";

// ── Execução depois da resposta ──────────────────────────────────────────────

/**
 * Roda `fn` depois que a resposta HTTP sair (cadastro não espera o SMTP).
 * `after()` só existe dentro de um request; fora dele (script, teste) cai
 * num fire-and-forget simples.
 */
export function runAfterResponse(fn: () => Promise<unknown>): void {
  const safe = () => fn().catch((err) => console.error("[lifecycle] tarefa em segundo plano", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

// ── Idioma ───────────────────────────────────────────────────────────────────

/** Idioma do request atual: cookie do site → país do IP → pt. Nunca lança. */
export async function localeFromRequest(): Promise<Lang> {
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (c === "en" || c === "pt") return c;
  } catch { /* fora de request */ }
  try {
    const h = await headers();
    const country = h.get("x-vercel-ip-country")?.toUpperCase();
    if (country) return PT_COUNTRIES.has(country) ? "pt" : "en";
    const al = h.get("accept-language")?.toLowerCase() ?? "";
    if (al && !al.startsWith("pt")) return "en";
  } catch { /* fora de request */ }
  return "pt";
}

function asLang(v: unknown): Lang {
  return v === "en" ? "en" : "pt";
}

async function getPrefs(userId: number): Promise<{ locale: Lang; optedOut: boolean }> {
  try {
    const [p] = await db.select().from(userEmailPrefs).where(eq(userEmailPrefs.userId, userId)).limit(1);
    return { locale: asLang(p?.locale), optedOut: Boolean(p?.optOutAt) };
  } catch (err) {
    console.error("[lifecycle] user_email_prefs indisponível (migração 0015 pendente?)", err);
    return { locale: "pt", optedOut: false };
  }
}

async function saveLocale(userId: number, locale: Lang): Promise<void> {
  await db
    .insert(userEmailPrefs)
    .values({ userId, locale })
    .onConflictDoUpdate({ target: userEmailPrefs.userId, set: { locale, updatedAt: new Date() } });
}

// ── Descadastro (HMAC, sem tabela de tokens) ─────────────────────────────────

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET não configurado");
  return s;
}

export function unsubscribeToken(userId: number): string {
  const sig = crypto.createHmac("sha256", secret()).update(`unsub|${userId}`).digest("base64url");
  return `${userId}.${sig}`;
}

/** Devolve o userId se o token for válido. Não expira: link de descadastro precisa funcionar sempre. */
export function verifyUnsubscribeToken(token: string): number | null {
  const [id, sig] = String(token).split(".");
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0 || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`unsub|${userId}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? userId : null;
}

export async function setOptOut(userId: number, optOut: boolean): Promise<void> {
  const optOutAt = optOut ? new Date() : null;
  await db
    .insert(userEmailPrefs)
    .values({ userId, optOutAt })
    .onConflictDoUpdate({ target: userEmailPrefs.userId, set: { optOutAt, updatedAt: new Date() } });
}

function unsubscribeUrl(userId: number): string {
  return `${siteUrl()}/api/email/unsubscribe?t=${encodeURIComponent(unsubscribeToken(userId))}`;
}

// ── Links ────────────────────────────────────────────────────────────────────

/** URL absoluta no idioma da pessoa, com UTM (senão o GA joga tudo em "Direto"). */
function link(path: string, lang: Lang, campaign: string): string {
  const u = new URL(`${siteUrl()}${localizePath(path, lang)}`);
  u.searchParams.set("utm_source", "lifecycle");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

// ── Template ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Mail = {
  subject: string;
  /** Parágrafos do corpo, em texto puro. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string };
  /** true = e-mail de engajamento (leva rodapé de descadastro). */
  marketing: boolean;
};

const FOOTER = {
  pt: {
    why: "Você recebe este e-mail porque criou uma conta no backingtrack.store.",
    unsub: "Não quer mais receber dicas e novidades?",
    unsubLink: "Descadastrar",
    reply: "É só responder este e-mail — eu leio todas as respostas.",
  },
  en: {
    why: "You're getting this email because you created an account at backingtrack.store.",
    unsub: "Don't want tips and news anymore?",
    unsubLink: "Unsubscribe",
    reply: "Just reply to this email — I read every reply.",
  },
} as const;

function render(mail: Mail, lang: Lang, userId: number): { text: string; html: string; unsub?: string } {
  const f = FOOTER[lang];
  const unsub = mail.marketing ? unsubscribeUrl(userId) : undefined;

  const textParts = [...mail.paragraphs];
  if (mail.cta) textParts.push(`${mail.cta.label}:\n${mail.cta.url}`);
  if (mail.secondary) textParts.push(`${mail.secondary.label}:\n${mail.secondary.url}`);
  textParts.push(`— ${SENDER}\nBackingTrack.store`);
  if (unsub) textParts.push(`${f.why}\n${f.unsub} ${unsub}`);
  const text = textParts.join("\n\n");

  const p = mail.paragraphs.map((x) => `<p style="margin:0 0 14px">${esc(x)}</p>`).join("\n");
  const cta = mail.cta
    ? `<p style="margin:24px 0"><a href="${esc(mail.cta.url)}" style="background:#0D0D0F;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${esc(mail.cta.label)}</a></p>`
    : "";
  const secondary = mail.secondary
    ? `<p style="margin:0 0 18px;font-size:14px"><a href="${esc(mail.secondary.url)}" style="color:#E08600">${esc(mail.secondary.label)} →</a></p>`
    : "";
  const footer = unsub
    ? `<p style="font-size:12px;color:#999;margin-top:28px;border-top:1px solid #eee;padding-top:14px">${esc(f.why)}<br>${esc(f.unsub)} <a href="${esc(unsub)}" style="color:#999">${esc(f.unsubLink)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:520px;margin:0 auto;padding:24px;font-size:15px">
<p style="font-size:18px;font-weight:800;margin:0 0 18px">BackingTrack<span style="color:#FF9A00">.store</span></p>
${p}
${cta}
${secondary}
<p style="margin:18px 0 0">— ${esc(SENDER)}</p>
${footer}
</body></html>`;
  return { text, html, unsub };
}

function firstName(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  if (n && !n.includes("@")) return n;
  return email.split("@")[0];
}

function compose(kind: LifecycleKind, lang: Lang, name: string, hasUpload: boolean): Mail {
  const upload = link("/upload", lang, kind);
  const catalog = link("/catalogo", lang, kind);
  const mySongs = link("/perfil", lang, kind);
  const reply = FOOTER[lang].reply;

  if (lang === "en") {
    switch (kind) {
      case "welcome":
        return {
          subject: "Your 3 free song separations are ready",
          paragraphs: [
            `Hi ${name}, thanks for joining BackingTrack.store. I'm Luiz — a musician and the person building this.`,
            "The quickest way to see what it does: upload a song you're practicing. In a few minutes you get drums, bass, guitar, keys and vocals on separate tracks, plus the chord chart. Mute your instrument and play along with the band.",
            "Your Free plan includes 3 separations every month.",
            `Anything get in the way? ${reply}`,
          ],
          cta: { label: "Split my first song", url: upload },
          secondary: { label: "Or try a ready-made track from the catalog", url: catalog },
          marketing: true,
        };
      case "nudge_upload":
        return {
          subject: "Which song are you practicing this week?",
          paragraphs: [
            `Hi ${name}, you haven't split a song yet — it takes one audio file and about three minutes.`,
            "Pick the song you're rehearsing right now, upload it and mute your part. That's when the site starts to make sense.",
            `If something didn't work, or the song you wanted isn't supported, I'd really like to know. ${reply}`,
          ],
          cta: { label: "Upload a song", url: upload },
          marketing: true,
        };
      case "week_one":
        return hasUpload
          ? {
              subject: "3 things worth trying on your songs",
              paragraphs: [
                `Hi ${name}, one week in — here's what most people miss on the first try:`,
                "1. Loop the tricky part: select a section and it repeats until you nail it.\n2. Change speed or key without leaving the player.\n3. Build a setlist for your next rehearsal or gig — and share it with your band.",
                `What would make this more useful for you? ${reply}`,
              ],
              cta: { label: "Open my songs", url: mySongs },
              marketing: true,
            }
          : {
              subject: "Your free separations are still waiting",
              paragraphs: [
                `Hi ${name}, it's been a week since you signed up and your 3 free separations are still unused.`,
                "Upload any song you play — we split it into separate instruments and add the chords, so you can practice with the band minus you.",
                `If the site isn't what you expected, tell me what you were looking for. ${reply}`,
              ],
              cta: { label: "Split a song now", url: upload },
              secondary: { label: "Browse the backing-track catalog", url: catalog },
              marketing: true,
            };
    }
  }

  switch (kind) {
    case "welcome":
      return {
        subject: "Suas 3 separações grátis estão liberadas",
        paragraphs: [
          `Oi, ${name}! Obrigado por entrar no BackingTrack.store. Eu sou o Luiz — músico e quem está construindo o site.`,
          "O jeito mais rápido de entender o que ele faz: envie uma música que você está tirando. Em poucos minutos você recebe bateria, baixo, guitarra, teclado e voz em faixas separadas, mais a cifra. Silencia o seu instrumento e toca junto com a banda.",
          "O plano Free inclui 3 separações por mês.",
          `Travou em alguma coisa? ${reply}`,
        ],
        cta: { label: "Separar minha primeira música", url: upload },
        secondary: { label: "Ou teste uma base pronta do catálogo", url: catalog },
        marketing: true,
      };
    case "nudge_upload":
      return {
        subject: "Qual música você está ensaiando esta semana?",
        paragraphs: [
          `Oi, ${name}! Você ainda não separou nenhuma música — basta um arquivo de áudio e uns três minutos.`,
          "Escolha a música que está ensaiando agora, envie e silencie a sua parte. É aí que o site faz sentido.",
          `Se algo não funcionou, ou a música que você queria não deu certo, quero muito saber. ${reply}`,
        ],
        cta: { label: "Enviar uma música", url: upload },
        marketing: true,
      };
    case "week_one":
      return hasUpload
        ? {
            subject: "3 recursos que valem testar nas suas músicas",
            paragraphs: [
              `Oi, ${name}! Uma semana depois, o que quase todo mundo deixa passar na primeira vez:`,
              "1. Loop do trecho difícil: selecione a parte e ela repete até sair.\n2. Mude andamento ou tom sem sair do player.\n3. Monte o setlist do próximo ensaio ou show — e compartilhe com a banda.",
              `O que deixaria o site mais útil para você? ${reply}`,
            ],
            cta: { label: "Abrir minhas músicas", url: mySongs },
            marketing: true,
          }
        : {
            subject: "Suas separações grátis ainda estão esperando",
            paragraphs: [
              `Oi, ${name}! Faz uma semana que você se cadastrou e as 3 separações grátis ainda não foram usadas.`,
              "Envie qualquer música que você toca — a gente separa os instrumentos e coloca a cifra, para você ensaiar com a banda sem a sua parte.",
              `Se o site não é o que você esperava, me conta o que estava procurando. ${reply}`,
            ],
            cta: { label: "Separar uma música agora", url: upload },
            secondary: { label: "Ver o catálogo de bases", url: catalog },
            marketing: true,
          };
  }
}

// ── Envio ────────────────────────────────────────────────────────────────────

type Target = { id: number; email: string; name: string | null; role: string; status: string };

async function loadUser(userId: number): Promise<Target | null> {
  const [u] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

async function hasUploaded(userId: number): Promise<boolean> {
  const [r] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(eq(songs.uploadedByUserId, userId), eq(songs.sourceType, "user_upload")))
    .limit(1);
  return Boolean(r);
}

function eligible(u: Target | null): u is Target {
  return Boolean(u && u.status === "active" && u.role !== "admin" && !isInternalTestEmail(u.email));
}

/**
 * Envia um e-mail da sequência, no máximo uma vez por pessoa e tipo.
 * A linha em lifecycle_emails é reservada ANTES do envio (é a trava contra dois
 * crons simultâneos); se o SMTP falhar, a reserva é desfeita para o próximo
 * cron tentar de novo. Devolve true se enviou.
 */
export async function sendLifecycleEmail(userId: number, kind: LifecycleKind): Promise<boolean> {
  if (!mailerConfigured()) return false;
  const u = await loadUser(userId);
  if (!eligible(u)) return false;

  const prefs = await getPrefs(userId);
  if (prefs.optedOut) return false;

  const claimed = await db
    .insert(lifecycleEmails)
    .values({ userId, kind })
    .onConflictDoNothing()
    .returning({ id: lifecycleEmails.id });
  if (claimed.length === 0) return false; // já enviado antes

  try {
    const uploaded = kind === "week_one" ? await hasUploaded(userId) : false;
    const mail = compose(kind, prefs.locale, firstName(u.name, u.email), uploaded);
    const { text, html, unsub } = render(mail, prefs.locale, userId);
    await sendMail({ to: u.email, toName: u.name, subject: mail.subject, text, html, unsubscribeUrl: unsub });
    return true;
  } catch (err) {
    await db.delete(lifecycleEmails).where(eq(lifecycleEmails.id, claimed[0].id)).catch(() => {});
    throw err;
  }
}

/**
 * Chamar logo depois de criar a conta (cadastro por senha, Google ou link).
 * Guarda o idioma e manda as boas-vindas depois da resposta HTTP.
 */
export function onUserCreated(userId: number, locale?: string | null): void {
  runAfterResponse(async () => {
    const lang = locale === "en" || locale === "pt" ? locale : await localeFromRequest();
    try {
      await saveLocale(userId, lang);
    } catch (err) {
      console.error("[lifecycle] não salvou idioma (migração 0015 pendente?)", err);
    }
    await sendLifecycleEmail(userId, "welcome");
  });
}

/** "Sua música está pronta" — transacional, no idioma da pessoa. Nunca lança. */
export async function sendSongReadyEmail(userId: number, songTitle: string, slug: string): Promise<void> {
  try {
    if (!mailerConfigured()) return;
    const u = await loadUser(userId);
    if (!u || u.status !== "active") return;
    const { locale } = await getPrefs(userId);
    const url = link(`/song/${slug}`, locale, "song_ready");
    const mail: Mail =
      locale === "en"
        ? {
            subject: `"${songTitle}" is ready to play`,
            paragraphs: [
              "Your stems are separated. Open the song, mute your instrument and play along — the chord chart is generated in the next few minutes.",
            ],
            cta: { label: "Open the song", url },
            marketing: false,
          }
        : {
            subject: `"${songTitle}" está pronta para tocar`,
            paragraphs: [
              "As faixas já foram separadas. Abra a música, silencie o seu instrumento e toque junto — a cifra fica pronta nos próximos minutos.",
            ],
            cta: { label: "Abrir a música", url },
            marketing: false,
          };
    const { text, html } = render(mail, locale, userId);
    await sendMail({ to: u.email, toName: u.name, subject: mail.subject, text, html });
  } catch (err) {
    console.error("[lifecycle] song_ready", userId, err);
  }
}

/**
 * Cópia por e-mail de um aviso do /admin/mensagens. Respeita descadastro.
 * O texto vai como o admin escreveu (é ele quem escolhe o idioma do aviso).
 */
export async function sendBroadcastEmail(
  userId: number,
  input: { title: string; body?: string | null; link?: string | null },
): Promise<boolean> {
  if (!mailerConfigured()) return false;
  const u = await loadUser(userId);
  if (!u || u.status !== "active") return false;
  const prefs = await getPrefs(userId);
  if (prefs.optedOut) return false;

  let url: string | undefined;
  if (input.link) {
    url = /^https?:\/\//i.test(input.link)
      ? input.link
      : link(input.link.startsWith("/") ? input.link : `/${input.link}`, prefs.locale, "broadcast");
  }
  const mail: Mail = {
    subject: input.title,
    paragraphs: (input.body ?? "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    cta: url ? { label: prefs.locale === "en" ? "Open" : "Abrir", url } : undefined,
    marketing: true,
  };
  if (mail.paragraphs.length === 0) mail.paragraphs = [input.title];
  const { text, html, unsub } = render(mail, prefs.locale, userId);
  await sendMail({ to: u.email, toName: u.name, subject: mail.subject, text, html, unsubscribeUrl: unsub });
  return true;
}

// ── Cron diário ──────────────────────────────────────────────────────────────

/**
 * Janelas por idade da conta. Limitadas de propósito: contas antigas NÃO
 * recebem a sequência retroativamente (seria disparo frio, não boas-vindas).
 *   welcome       criadas há ≤ 3 dias e sem boas-vindas (repescagem de falha)
 *   nudge_upload  2–6 dias, ainda sem nenhuma separação
 *   week_one      7–13 dias
 */
export async function runLifecycle(): Promise<Record<LifecycleKind, { sent: number; failed: number }>> {
  const now = Date.now();
  const testEmails = internalTestEmailsOrUndefined();
  const base = and(
    eq(users.status, "active"),
    ne(users.role, "admin"),
    isNull(users.deletionScheduledAt),
    testEmails ? notInArray(users.email, testEmails) : undefined,
  );

  const window = (minDays: number, maxDays: number) =>
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          base,
          gte(users.createdAt, new Date(now - maxDays * DAY)),
          lt(users.createdAt, new Date(now - minDays * DAY)),
        ),
      );

  const noUpload = sql`NOT EXISTS (SELECT 1 FROM songs s WHERE s.uploaded_by_user_id = ${users.id} AND s.source_type = 'user_upload')`;

  const plan: [LifecycleKind, number[]][] = [
    ["welcome", (await window(0, 3)).map((r) => r.id)],
    [
      "nudge_upload",
      (
        await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              base,
              gte(users.createdAt, new Date(now - 6 * DAY)),
              lt(users.createdAt, new Date(now - 2 * DAY)),
              noUpload,
            ),
          )
      ).map((r) => r.id),
    ],
    ["week_one", (await window(7, 13)).map((r) => r.id)],
  ];

  const result = {
    welcome: { sent: 0, failed: 0 },
    nudge_upload: { sent: 0, failed: 0 },
    week_one: { sent: 0, failed: 0 },
  };

  for (const [kind, ids] of plan) {
    for (const id of ids) {
      try {
        if (await sendLifecycleEmail(id, kind)) result[kind].sent++;
      } catch (err) {
        result[kind].failed++;
        console.error("[lifecycle] cron", kind, id, err);
      }
    }
  }
  return result;
}

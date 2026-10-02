/**
 * E-mails transacionais de acesso: recuperar senha e link de entrada.
 * Saem pelo mesmo SMTP do Zoho dos convites (src/lib/mailer.ts).
 *
 * Texto curto, sem marketing, com o link sozinho numa linha e a validade
 * explícita — é o que reduz o risco de parecer phishing.
 */
import { sendMail } from "@/src/lib/mailer";

type Lang = "pt" | "en";

const COPY = {
  reset: {
    pt: {
      subject: "Redefinir sua senha — BackingTrack.store",
      intro: "Recebemos um pedido para redefinir a senha da sua conta.",
      cta: "Criar nova senha",
      expiry: "O link vale por 1 hora e deixa de funcionar assim que a senha for trocada.",
      ignore: "Se não foi você, ignore este e-mail — sua senha continua a mesma.",
    },
    en: {
      subject: "Reset your password — BackingTrack.store",
      intro: "We received a request to reset your account password.",
      cta: "Set a new password",
      expiry: "The link is valid for 1 hour and stops working once the password is changed.",
      ignore: "If this wasn't you, ignore this email — your password stays the same.",
    },
  },
  magic: {
    pt: {
      subject: "Seu link de acesso — BackingTrack.store",
      intro: "Use o link abaixo para entrar. Se você ainda não tem conta, ela é criada agora, no plano Free.",
      cta: "Entrar no BackingTrack.store",
      expiry: "O link vale por 20 minutos.",
      ignore: "Se não foi você que pediu, ignore este e-mail.",
    },
    en: {
      subject: "Your sign-in link — BackingTrack.store",
      intro: "Use the link below to sign in. If you don't have an account yet, a Free one is created now.",
      cta: "Sign in to BackingTrack.store",
      expiry: "The link is valid for 20 minutes.",
      ignore: "If you didn't request this, ignore this email.",
    },
  },
} as const;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function send(kind: "reset" | "magic", lang: Lang, to: string, url: string): Promise<void> {
  const c = COPY[kind][lang];
  const text = `${c.intro}\n\n${c.cta}:\n${url}\n\n${c.expiry}\n${c.ignore}\n\nBackingTrack.store`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:800;margin:0 0 16px">BackingTrack<span style="color:#FF9A00">.store</span></p>
<p>${escapeHtml(c.intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#0D0D0F;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(c.cta)}</a></p>
<p style="font-size:13px;color:#666">${escapeHtml(c.expiry)}<br>${escapeHtml(c.ignore)}</p>
<p style="font-size:12px;color:#999;word-break:break-all">${escapeHtml(url)}</p>
</body></html>`;
  await sendMail({ to, subject: c.subject, text, html });
}

export const sendResetEmail = (lang: Lang, to: string, url: string) => send("reset", lang, to, url);
export const sendMagicLinkEmail = (lang: Lang, to: string, url: string) => send("magic", lang, to, url);

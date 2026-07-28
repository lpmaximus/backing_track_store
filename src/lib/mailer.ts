/**
 * Envio de e-mail transacional via SMTP autenticado do Zoho.
 *
 * Decisão (2026-07-27): os convites saem de contato@l2techs.com pelo próprio
 * Zoho, e não por um ESP de terceiros. Consequência prática: o envio é
 * autenticado com SPF+DKIM do domínio que a pessoa já conhece — o ponto nº 1
 * de qualquer checklist antiphishing — mas NÃO temos webhook de entrega/bounce.
 * Por isso o funil rastreado começa no clique do link (ver src/lib/invites.ts).
 *
 * Runtime: Node (nodemailer abre socket TLS). Toda rota que importar este
 * arquivo precisa de `export const runtime = "nodejs"`.
 *
 * Variáveis de ambiente:
 *   SMTP_HOST      smtp.zoho.com   (ou smtp.zoho.eu / .in conforme a região da conta)
 *   SMTP_PORT      465
 *   SMTP_USER      contato@l2techs.com
 *   SMTP_PASSWORD  senha de aplicativo do Zoho (NÃO a senha da conta)
 *   MAIL_FROM_NAME Backing Track Store
 *   MAIL_FROM      contato@l2techs.com
 *   MAIL_REPLY_TO  contato@l2techs.com
 */
// Import nomeado (e não default): nodemailer é CJS e o default só existe via
// interop — nomeado funciona igual no bundle do Next e no Node direto.
import { createTransport, type Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function transporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 465);
  cached = createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port,
    secure: port === 465, // 465 = TLS implícito (padrão do Zoho); 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
  });
  return cached;
}

export type MailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html: string;
  /** URL de descadastro — vira header List-Unsubscribe (sinal antispam forte). */
  unsubscribeUrl?: string;
};

/**
 * Envia e devolve o messageId. Lança em caso de falha — quem chama grava a
 * mensagem de erro no convite para o admin ver na tabela.
 */
export async function sendMail(input: MailInput): Promise<string> {
  if (!mailerConfigured()) {
    throw new Error(
      "SMTP não configurado: defina SMTP_USER e SMTP_PASSWORD (senha de aplicativo do Zoho).",
    );
  }

  const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER!;
  const fromName = process.env.MAIL_FROM_NAME || "Backing Track Store";
  const replyTo = process.env.MAIL_REPLY_TO || fromEmail;

  const headers: Record<string, string> = {
    // Marca a mensagem como automática, mas não como marketing em massa:
    // filtros usam isso para não classificar como bulk promocional.
    "Auto-Submitted": "auto-generated",
  };
  if (input.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>, <mailto:${replyTo}?subject=Descadastrar>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const info = await transporter().sendMail({
    from: { name: fromName, address: fromEmail },
    to: input.toName ? { name: input.toName, address: input.to } : input.to,
    replyTo,
    subject: input.subject,
    // Sempre multipart: só-HTML é um dos sinais de spam mais baratos de evitar.
    text: input.text,
    html: input.html,
    headers,
  });

  return info.messageId;
}

/**
 * Montagem do e-mail de convite — texto puro + HTML.
 *
 * ─── Por que este arquivo existe (o problema do "parece phishing") ───────────
 * Um e-mail frio oferecendo acesso pago de graça tem exatamente a mesma forma
 * de um golpe. O que separa um do outro não é o design bonito: é um conjunto de
 * sinais verificáveis. Este módulo materializa esses sinais:
 *
 *  1. Remetente do domínio real (contato@l2techs.com) com SPF+DKIM+DMARC — feito
 *     no DNS/Zoho, ver docs/CONVITES.md.
 *  2. Link honesto: a URL aparece escrita por extenso, igual ao destino, sem
 *     encurtador e sem redirect de terceiro. Domínio = backingtrack.store.
 *  3. Bloco de segurança explícito: "nunca pedimos senha/CPF/cartão por e-mail".
 *  4. Sem anexo, sem imagem remota, sem formulário dentro do e-mail.
 *  5. Multipart (texto + HTML) e List-Unsubscribe — o oposto do padrão de spam.
 *  6. Contexto pessoal: nome de quem convida, motivo do envio e prazo real,
 *     sem urgência artificial ("clique em 24h ou perde").
 *  7. Identificação completa no rodapé (empresa + e-mail que responde de fato).
 *
 * O corpo é editável no admin em TEXTO PURO com placeholders; o HTML é gerado
 * aqui. Isso impede que um ajuste de texto quebre a estrutura de segurança.
 */

export type InvitePlan = "pro" | "proband";

export const PLAN_LABEL: Record<InvitePlan, string> = {
  pro: "Pro (individual)",
  proband: "Pro Band (banda)",
};

/** Placeholders aceitos no corpo do template, para exibir no admin. */
export const PLACEHOLDERS = [
  { key: "{{nome}}", desc: "primeiro nome do convidado (ou 'Olá' se vazio)" },
  { key: "{{plano}}", desc: "Pro (individual) ou Pro Band (banda)" },
  { key: "{{dias}}", desc: "duração do teste em dias" },
  { key: "{{separacoes}}", desc: "quantas separações o teste libera no total" },
  { key: "{{link}}", desc: "link único do convite" },
  { key: "{{validade}}", desc: "data limite para aceitar o convite" },
  { key: "{{email}}", desc: "e-mail do convidado" },
  { key: "{{remetente}}", desc: "quem assina o convite" },
] as const;

export const DEFAULT_SUBJECT =
  "{{nome}}, seu acesso de teste ao Backing Track Store ({{dias}} dias)";

export const DEFAULT_BODY = `Olá, {{nome}}!

Aqui é o {{remetente}}, da L2techs. Estamos abrindo o Backing Track Store para um grupo pequeno de músicos testarem antes do lançamento — e você está nesse grupo.

O que é: uma plataforma para ensaiar e tocar com backing tracks de verdade. Você separa a música em faixas (bateria, baixo, guitarra, teclado, voz), tira o instrumento que você toca, ajusta o volume de cada faixa, vê a cifra sincronizada com o áudio e ainda monta o repertório da banda.

O que estou te oferecendo: acesso {{plano}} liberado por {{dias}} dias, com {{separacoes}} separações de música incluídas, sem cobrança e sem cadastrar cartão. No fim do período a conta volta sozinha para o plano gratuito — nada é cobrado, nada renova automaticamente.

Para ativar, é só abrir o link abaixo e entrar com seu e-mail ou com sua conta Google. O convite vale até {{validade}}.

Se não fizer sentido pra você, pode ignorar este e-mail — não vou insistir. E se tiver qualquer dúvida, é só responder aqui: esta caixa é minha e eu leio.

Abraço,
{{remetente}}`;

/**
 * Texto curto para envio MANUAL (WhatsApp, DM, Telegram).
 *
 * Por que é diferente do e-mail: numa conversa a pessoa já sabe quem você é, o
 * canal já é confiável e mensagem longa não é lida. Some o rodapé institucional,
 * o bloco antiphishing e o descadastro — nada disso faz sentido aqui. O que
 * permanece é o essencial: quem fala, o que é, o que a pessoa ganha, o link
 * inteiro e visível, e a ausência de cobrança dita com todas as letras.
 *
 * O link vai numa linha só, sem texto colado, porque os apps de mensagem
 * quebram a detecção do link quando há pontuação grudada no fim.
 */
export const DEFAULT_SHARE_BODY = `Oi, {{nome}}! Aqui é o {{remetente}}.

Tô abrindo o Backing Track Store pra um grupo pequeno de músicos testarem antes do lançamento e separei um acesso pra você.

É uma plataforma pra ensaiar: separa a música em faixas (bateria, baixo, guitarra, teclado, voz), você tira o instrumento que toca e toca por cima, com a cifra rolando sincronizada.

Teu acesso {{plano}} fica liberado por {{dias}} dias, com {{separacoes}} separações. Sem cobrança e sem cadastrar cartão — no fim volta sozinho pro plano gratuito.

É só abrir e entrar com o Google:

{{link}}

Vale até {{validade}}. Qualquer coisa me chama por aqui mesmo.`;

/**
 * Primeiro nome, ou string VAZIA quando não há nome. Vazio de propósito: quem
 * limpa a frase depois é `tidy()`. Devolver um fallback aqui (era "Olá") gerava
 * "Olá, Olá!" quando o template já trazia a saudação.
 */
export function firstName(name?: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

/** Saudação pronta: "Olá, João" ou só "Olá". Para uso na UI. */
export function greeting(name?: string | null): string {
  const f = firstName(name);
  return f ? `Olá, ${f}` : "Olá";
}

/**
 * Conserta as sobras de pontuação quando {{nome}} vem vazio:
 *   "Olá, !"                  → "Olá!"
 *   ", seu acesso de teste…"  → "Seu acesso de teste…"
 * Sem isto, um convite sem nome preenchido sai com cara de mala direta
 * quebrada — que é exatamente a impressão que a gente está evitando.
 */
function tidy(s: string): string {
  const cleaned = s
    .replace(/,\s*([!?.,])/g, "$1")   // "Olá, !" → "Olá!"
    .replace(/[ \t]{2,}/g, " ");
  const stripped = cleaned.replace(/^\s*,\s*/, ""); // ", seu acesso" → "seu acesso"

  // Só recapitaliza a linha se ela realmente perdeu uma vírgula órfã no início.
  // Sem essa condição, uma linha que começa minúscula de propósito vira outra
  // coisa — o caso real foi o link sozinho na mensagem virando "Https://".
  return stripped === cleaned
    ? cleaned
    : stripped.replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
}

export function formatDate(d: Date): string {
  // Fuso fixo: o servidor roda em UTC na Vercel, e sem isto uma data gerada
  // à noite aparece um dia à frente para quem lê no Brasil.
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export type InviteVars = {
  name?: string | null;
  email: string;
  plan: InvitePlan;
  days: number;
  /** Cota de separações do teste (total do período). */
  separations: number;
  link: string;
  expiresAt: Date;
  sender: string;
};

export function renderTemplate(tpl: string, v: InviteVars): string {
  const raw = tpl
    .replaceAll("{{nome}}", firstName(v.name))
    .replaceAll("{{plano}}", PLAN_LABEL[v.plan])
    .replaceAll("{{dias}}", String(v.days))
    .replaceAll("{{separacoes}}", String(v.separations))
    .replaceAll("{{link}}", v.link)
    .replaceAll("{{validade}}", formatDate(v.expiresAt))
    .replaceAll("{{email}}", v.email)
    .replaceAll("{{remetente}}", v.sender);

  // tidy por linha: preserva os parágrafos e conserta cada frase isolada.
  return raw.split("\n").map(tidy).join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SECURITY_TEXT = (link: string, email: string) =>
`--------------------------------------------------
COMO SABER QUE ESTE E-MAIL É LEGÍTIMO
- Ele veio de contato@l2techs.com e é assinado (SPF/DKIM). Responda a este
  e-mail e uma pessoa responde de volta.
- O único link aqui é ${link} — confira que começa com
  https://backingtrack.store/ antes de clicar.
- NUNCA pedimos senha, CPF, dados bancários ou cartão por e-mail. Nenhuma
  página nossa pede isso para começar o teste.
- Não há anexo nem formulário dentro deste e-mail.
- Você recebeu em ${email} porque foi convidado(a) pessoalmente. Se não
  quiser receber mais nada, responda "descadastrar" e paramos por aqui.
--------------------------------------------------`;

/** Corpo em texto puro completo (o que a pessoa vê em clientes sem HTML). */
export function buildText(body: string, v: InviteVars, unsubscribeUrl: string): string {
  return [
    renderTemplate(body, v),
    "",
    `ATIVAR MEU TESTE: ${v.link}`,
    "",
    SECURITY_TEXT(v.link, v.email),
    "",
    "L2techs — Backing Track Store",
    "contato@l2techs.com · https://backingtrack.store",
    `Descadastrar: ${unsubscribeUrl}`,
  ].join("\n");
}

/**
 * HTML sem imagem remota, sem script, sem tabela de tracking. Cores da marca
 * (#0D0D0F / #FF9A00) inline para não depender de CSS externo.
 */
export function buildHtml(body: string, v: InviteVars, unsubscribeUrl: string): string {
  const paragraphs = renderTemplate(body, v)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const link = escapeHtml(v.link);

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(v.sender)} convidou você para o Backing Track Store</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1e;font-size:15px;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e8;border-radius:14px;overflow:hidden;">

  <div style="background:#0D0D0F;padding:20px 28px;">
    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">Backing<span style="color:#FF9A00;">Track</span>.store</span>
    <div style="color:#8a8a92;font-size:12px;margin-top:2px;">um produto L2techs</div>
  </div>

  <div style="padding:28px;">
    ${paragraphs}

    <div style="margin:28px 0 12px;">
      <a href="${link}" style="display:inline-block;background:#FF9A00;color:#0D0D0F;font-weight:800;font-size:15px;text-decoration:none;padding:14px 26px;border-radius:10px;">Ativar meus ${v.days} dias</a>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#6b6b73;line-height:1.5;">
      Prefere não clicar em botão? Copie e cole este endereço no navegador:<br>
      <span style="color:#1a1a1e;word-break:break-all;">${link}</span>
    </p>

    <div style="border:1px solid #e4e4e8;border-left:3px solid #FF9A00;border-radius:8px;padding:16px 18px;background:#fafafb;font-size:13px;line-height:1.6;color:#3a3a42;">
      <strong style="color:#1a1a1e;">Como saber que este e-mail é legítimo</strong>
      <ul style="margin:10px 0 0;padding-left:18px;">
        <li>Veio de <strong>contato@l2techs.com</strong>, com assinatura SPF/DKIM do domínio. Responda: uma pessoa responde de volta.</li>
        <li>O único link aqui começa com <strong>https://backingtrack.store/</strong>. Passe o mouse e confira antes de clicar.</li>
        <li><strong>Nunca pedimos senha, CPF, dados bancários ou cartão por e-mail.</strong> Nenhuma página nossa pede isso para começar o teste.</li>
        <li>Não há anexo nem formulário dentro deste e-mail.</li>
        <li>Você recebeu em <strong>${escapeHtml(v.email)}</strong> porque foi convidado(a) pessoalmente.</li>
      </ul>
    </div>
  </div>

  <div style="border-top:1px solid #e4e4e8;padding:18px 28px;font-size:12px;color:#8a8a92;line-height:1.6;">
    L2techs · Backing Track Store<br>
    <a href="mailto:contato@l2techs.com" style="color:#8a8a92;">contato@l2techs.com</a> ·
    <a href="https://backingtrack.store" style="color:#8a8a92;">backingtrack.store</a><br>
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8a92;">Não quero receber convites</a>
  </div>

</div>
</body></html>`;
}

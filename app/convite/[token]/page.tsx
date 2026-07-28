/**
 * /convite/<token> — página de destino do convite de teste.
 *
 * Papel dela no combate ao "parece phishing": é aqui que a promessa do e-mail
 * é verificada. A página está no domínio real, sob HTTPS, com a identidade
 * visual do site, e NÃO pede nenhum dado — quem não está logado é mandado para
 * o login padrão do site (/entrar), o mesmo de sempre. Nenhum formulário de
 * senha vive nesta rota.
 *
 * Server component: marca o clique (funil) antes de renderizar.
 */
import Link from "next/link";
import { auth } from "@/auth";
import { loadInvite, markClicked } from "@/src/lib/invites";
import { PLAN_LABEL, firstName, formatDate, type InvitePlan } from "@/src/lib/inviteEmail";
import AceitarConvite from "./AceitarConvite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16, padding: "36px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text)" }}>
            Backing<span style={{ color: "var(--accent)" }}>Track</span>.store
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  await markClicked(token);
  const state = await loadInvite(token);

  if (!state.ok) {
    const msg =
      state.reason === "expired"
        ? "Este convite expirou. Se ainda tiver interesse, responda o e-mail que você recebeu e a gente gera um novo."
        : state.reason === "revoked"
          ? "Este convite foi cancelado."
          : "Convite não encontrado. Confira se o endereço foi copiado inteiro.";
    return (
      <Shell>
        <h1 style={{ color: "var(--text)", fontSize: 20, fontWeight: 800, marginTop: 0 }}>Convite indisponível</h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6 }}>{msg}</p>
        <Link href="/" className="btn-primary" style={{ display: "inline-flex", marginTop: 12 }}>
          Conhecer o site
        </Link>
      </Shell>
    );
  }

  const invite = state.invite;
  const session = await auth();
  const planLabel = PLAN_LABEL[invite.plan as InvitePlan] ?? invite.plan;

  return (
    <Shell>
      <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 900, margin: "0 0 6px", textAlign: "center" }}>
        {firstName(invite.name)}, seu teste está reservado
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
        Acesso <strong style={{ color: "var(--accent)" }}>{planLabel}</strong> por{" "}
        <strong style={{ color: "var(--text)" }}>{invite.trialDays} dias</strong>, sem cobrança e sem cartão.
      </p>

      <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, margin: "0 0 24px", paddingLeft: 20 }}>
        <li>Separação da música em faixas (bateria, baixo, guitarra, teclado, voz)</li>
        <li>Tire o seu instrumento e toque por cima</li>
        <li>Cifra e letra sincronizadas com o áudio</li>
        <li>Setlists e ensaio com a banda{invite.plan === "proband" ? " (até 6 integrantes)" : ""}</li>
      </ul>

      {invite.status === "accepted" ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text)", fontSize: 15, marginBottom: 16 }}>
            Este convite já foi ativado
            {invite.trialEndsAt ? ` e vale até ${formatDate(invite.trialEndsAt)}` : ""}.
          </p>
          <Link href="/" className="btn-primary" style={{ display: "inline-flex" }}>
            Ir para o catálogo
          </Link>
        </div>
      ) : session?.user ? (
        <AceitarConvite token={token} days={invite.trialDays} />
      ) : (
        <div style={{ textAlign: "center" }}>
          <Link href={`/entrar?callbackUrl=${encodeURIComponent(`/convite/${token}`)}`} className="btn-primary" style={{ display: "inline-flex", padding: "13px 28px" }}>
            Entrar ou criar conta para ativar
          </Link>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "12px 0 0" }}>
            Você vai para a tela de login normal do site. Nada é cobrado.
          </p>
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)", color: "var(--muted2)", fontSize: 12, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--muted)" }}>Segurança:</strong> nunca pedimos senha, CPF, dados
        bancários ou cartão por e-mail — nem nesta página. O convite foi enviado para{" "}
        <strong style={{ color: "var(--muted)" }}>{invite.email}</strong> por contato@l2techs.com,
        e-mail oficial da L2techs. Em caso de dúvida, escreva para lá.{" "}
        <Link href={`/convite/${token}/sair`} style={{ color: "var(--muted2)", textDecoration: "underline" }}>
          Não quero receber convites
        </Link>
        .
      </div>
    </Shell>
  );
}

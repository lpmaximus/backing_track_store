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
import { getTranslations } from "next-intl/server";
import { Link, getPathname } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
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

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string; locale: Locale }>;
}) {
  const { token, locale } = await params;
  const t = await getTranslations("invite");

  // Volta para esta mesma página após o login, no idioma corrente.
  const callbackUrl = getPathname({
    href: { pathname: "/convite/[token]", params: { token } },
    locale,
  });

  await markClicked(token);
  const state = await loadInvite(token);

  if (!state.ok) {
    const msg =
      state.reason === "expired"
        ? t("expired")
        : state.reason === "revoked"
          ? t("revoked")
          : t("notFound");
    return (
      <Shell>
        <h1 style={{ color: "var(--text)", fontSize: 20, fontWeight: 800, marginTop: 0 }}>{t("unavailable")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6 }}>{msg}</p>
        <Link href="/" className="btn-primary" style={{ display: "inline-flex", marginTop: 12 }}>
          {t("discoverSite")}
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
        {firstName(invite.name) ? t("reservedNamed", { name: firstName(invite.name) as string }) : t("reserved")}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 15, textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
        {t.rich("accessLine", {
          accent: (c) => <strong style={{ color: "var(--accent)" }}>{c}</strong>,
          b: (c) => <strong style={{ color: "var(--text)" }}>{c}</strong>,
          days: invite.trialDays,
          planName: planLabel,
        })}
      </p>

      <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, margin: "0 0 24px", paddingLeft: 20 }}>
        <li>{t("benefit1")}</li>
        <li>{t("benefit2")}</li>
        <li>{t("benefit3")}</li>
        <li>{t("benefit4")}{invite.plan === "proband" ? t("benefit4Band") : ""}</li>
      </ul>

      {invite.status === "accepted" ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text)", fontSize: 15, marginBottom: 16 }}>
            {t("alreadyActivated")}
            {invite.trialEndsAt ? t("validUntil", { date: formatDate(invite.trialEndsAt) }) : ""}.
          </p>
          <Link href="/" className="btn-primary" style={{ display: "inline-flex" }}>
            {t("goToCatalog")}
          </Link>
        </div>
      ) : session?.user ? (
        <AceitarConvite token={token} days={invite.trialDays} />
      ) : (
        <div style={{ textAlign: "center" }}>
          <Link href={{ pathname: "/entrar", query: { callbackUrl } }} className="btn-primary" style={{ display: "inline-flex", padding: "13px 28px" }}>
            {t("signInToActivate")}
          </Link>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "12px 0 0" }}>
            {t("normalLogin")}
          </p>
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)", color: "var(--muted2)", fontSize: 12, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--muted)" }}>{t("securityLabel")}</strong>{t("securityText")}
        <strong style={{ color: "var(--muted)" }}>{invite.email}</strong>{t("securityText2")}
        <Link href={{ pathname: "/convite/[token]/sair", params: { token } }} style={{ color: "var(--muted2)", textDecoration: "underline" }}>
          {t("unsubscribe")}
        </Link>
        .
      </div>
    </Shell>
  );
}

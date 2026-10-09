import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { createHandoffCode, isValidChallenge } from "@/src/lib/authTokens";
import { APP_URL_SCHEME } from "@/src/lib/native";
import HandoffClient from "./HandoffClient";

export const dynamic = "force-dynamic";

/**
 * Ponte do login Google para o app nativo — esta página abre no NAVEGADOR DO
 * SISTEMA (Custom Tabs / SFSafariViewController), não no WebView do app.
 *
 *   app → /app/handoff?challenge=…  (sem sessão → Google → volta aqui)
 *       → com sessão: gera código curto amarrado ao challenge
 *       → store.backingtrack.app://auth?code=…  → app troca código+verifier
 *         por sessão (provider "app-handoff" em auth.ts)
 */
export default async function HandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { challenge = "" } = await searchParams;
  const t = await getTranslations({ locale, namespace: "app.handoff" });

  if (!isValidChallenge(challenge)) {
    return (
      <main className="app-screen app-screen--bare" style={{ justifyContent: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t("invalidTitle")}</h1>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>{t("invalidText")}</p>
      </main>
    );
  }

  const session = await auth();
  const email = session?.user?.email ?? null;
  const deepLink = email
    ? `${APP_URL_SCHEME}://auth?code=${encodeURIComponent(createHandoffCode(email, challenge))}`
    : null;

  return <HandoffClient email={email} deepLink={deepLink} />;
}

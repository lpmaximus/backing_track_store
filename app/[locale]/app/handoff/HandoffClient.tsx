"use client";

import { useEffect, useRef } from "react";
import { signIn, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { BrandMark, IconGoogle } from "../_components/AppIcons";

export default function HandoffClient({ email, deepLink }: { email: string | null; deepLink: string | null }) {
  const t = useTranslations("app.handoff");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Sem sessão: segue direto para o Google e volta para esta mesma URL.
    // Com sessão NÃO volta sozinho de propósito: o toque em "Voltar para o
    // app" é a confirmação da pessoa de que foi ela quem pediu o login (um link
    // /app/handoff mandado por terceiros não entra em conta nenhuma sem esse
    // toque). Bônus: o Chrome só abre esquema customizado com gesto do usuário.
    if (!email) void signIn("google", { callbackUrl: window.location.href });
  }, [email]);

  return (
    <main className="app-screen app-screen--bare" style={{ justifyContent: "center", gap: 20, paddingLeft: 24, paddingRight: 24 }}>
      <BrandMark size={40} />
      {email && deepLink ? (
        <>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{t("readyTitle")}</h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>{t("readyText", { email })}</p>
          <a href={deepLink} className="app-btn app-btn--primary">{t("backToApp")}</a>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={() => void signOut({ callbackUrl: window.location.href })}
          >
            {t("otherAccount")}
          </button>
        </>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{t("googleTitle")}</h1>
          <button type="button" className="app-btn app-btn--light"
            onClick={() => void signIn("google", { callbackUrl: window.location.href })}>
            <IconGoogle />{t("continueGoogle")}
          </button>
        </>
      )}
    </main>
  );
}

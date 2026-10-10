"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";

export default function SignOutButton() {
  const t = useTranslations("app.account");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="app-btn app-btn--ghost"
      disabled={busy}
      style={{ color: "#ff8a8a", borderColor: "#4a2a2a" }}
      onClick={async () => {
        setBusy(true);
        await signOut({ redirect: false });
        window.location.assign(locale === "en" ? "/en/app/boas-vindas" : "/app/boas-vindas");
      }}
    >
      {t("signOut")}
    </button>
  );
}

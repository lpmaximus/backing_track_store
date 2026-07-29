"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, getPathname } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";

type State = { phase: "idle" | "joining" | "done" | "error"; bandName?: string; error?: string };

export default function JoinContent({ token }: { token: string }) {
  const { data: session, status } = useSession();
  const locale = useLocale() as Locale;
  const t = useTranslations("invite");
  const tc = useTranslations("common");
  const [state, setState] = useState<State>({ phase: "idle" });

  // Depois do login o usuário volta para ESTA página, no idioma em que está
  // (/bandas/entrar/x em pt, /en/bands/join/x em en).
  const callbackUrl = getPathname({
    href: { pathname: "/bandas/entrar/[token]", params: { token } },
    locale,
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    if (state.phase !== "idle") return;
    setState({ phase: "joining" });
    (async () => {
      try {
        const res = await fetch(`/api/bands/join/${token}`, { method: "POST" });
        const data = await res.json();
        if (res.ok) setState({ phase: "done", bandName: data.band?.name });
        else setState({ phase: "error", error: data.error ?? t("errInvalid") });
      } catch {
        setState({ phase: "error", error: t("errConn") });
      }
    })();
  }, [status, token, state.phase, t]);

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center" as const };

  return (
    <div style={{ flex: 1, maxWidth: 520, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
      {status === "loading" ? null : !session?.user ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>{t("bandInvite")}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>{t("signInToAccept")}</p>
          <Link href={{ pathname: "/entrar", query: { callbackUrl } }} className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>{tc("signIn")}</Link>
        </div>
      ) : state.phase === "done" ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>{t("joinedTitle")}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
            {state.bandName ? t.rich("joinedNamed", { name: state.bandName, b: (c) => <strong>{c}</strong> }) : t("joinedPlain")}
          </p>
          <Link href="/bandas" className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>{t("seeMyBands")}</Link>
        </div>
      ) : state.phase === "error" ? (
        <div style={card}>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 8px", color: "var(--text)" }}>{t("joinFailed")}</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{state.error}</p>
        </div>
      ) : (
        <div style={card}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{t("joining")}</p>
        </div>
      )}
    </div>
  );
}

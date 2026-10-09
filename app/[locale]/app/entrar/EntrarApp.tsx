"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { gaEvent } from "@/src/lib/gaEvent";
import { isNativeApp, openInSystemBrowser, startHandoff } from "@/src/lib/native";
import { IconBack, IconGoogle, IconMail } from "../_components/AppIcons";

type Mode = "login" | "cadastro" | "forgot" | "magic";

/**
 * Entrar no app (Login.dc.html).
 *
 * Google dentro do app NÃO pode rodar no WebView (o Google bloqueia OAuth em
 * WebView). No app ele abre no navegador do sistema e volta por deep link —
 * ver /app/handoff e NativeBridge. No navegador comum é o signIn de sempre.
 */
export default function EntrarApp() {
  const locale = useLocale();
  const t = useTranslations("signIn");
  const ta = useTranslations("app.signIn");
  const tc = useTranslations("common");
  const sp = useSearchParams();
  const base = locale === "en" ? "/en/app" : "/app";

  const [mode, setMode] = useState<Mode>(sp.get("tab") === "cadastro" ? "cadastro" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sp.get("erro") === "handoff" ? ta("handoffFailed") : "");
  const [notice, setNotice] = useState("");

  // Link de acesso por e-mail aberto no celular: entra sozinho.
  const magicToken = sp.get("magic");
  const tried = useRef(false);
  useEffect(() => {
    if (!magicToken || tried.current) return;
    tried.current = true;
    (async () => {
      setLoading(true);
      const res = await signIn("magic-link", { token: magicToken, redirect: false });
      if (res?.error) { setError(t("magicInvalid")); setMode("magic"); setLoading(false); }
      else { gaEvent("login", { method: "magic_link" }); window.location.assign(base); }
    })();
  }, [magicToken, base, t]);

  function go(m: Mode) { setMode(m); setError(""); setNotice(""); }

  async function handleGoogle() {
    setError("");
    gaEvent("login", { method: "google" });
    if (isNativeApp()) {
      try {
        const challenge = await startHandoff();
        const url = `${window.location.origin}${base}/handoff?challenge=${encodeURIComponent(challenge)}`;
        await openInSystemBrowser(url);
      } catch {
        setError(tc("error"));
      }
      return;
    }
    setLoading(true);
    await signIn("google", { callbackUrl: base });
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (mode === "cadastro") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, eventId: crypto.randomUUID(), locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? tc("error"));
        setLoading(false);
        return;
      }
      gaEvent("sign_up", { method: "email" });
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError(t("invalidCredentials")); setLoading(false); return; }
    if (mode === "login") gaEvent("login", { method: "email" });
    window.location.assign(base);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });
    setLoading(false);
    if (res.status === 503) return setError(t("mailUnavailable"));
    if (!res.ok) return setError(tc("error"));
    setNotice(t("resetSent"));
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale, app: true }),
    });
    setLoading(false);
    if (res.status === 503) return setError(t("mailUnavailable"));
    if (!res.ok) return setError(tc("error"));
    setNotice(t("magicSent", { email }));
  }

  const title =
    mode === "login" ? t("title")
      : mode === "cadastro" ? ta("signUpTitle")
      : mode === "forgot" ? t("forgotTitle")
      : t("magicTitle");
  const subtitle =
    mode === "login" ? ta("signInText")
      : mode === "cadastro" ? ta("signUpText")
      : mode === "forgot" ? t("forgotHint")
      : t("magicHint");

  const backHref = mode === "login" || mode === "cadastro" ? null : () => go("login");

  if (magicToken && !error) {
    return (
      <main className="app-screen app-screen--bare" style={{ justifyContent: "center", alignItems: "center" }}>
        <p role="status" style={{ color: "var(--muted)", fontSize: 15 }}>{t("signingIn")}</p>
      </main>
    );
  }

  return (
    <main className="app-screen app-screen--bare" style={{ paddingLeft: 24, paddingRight: 24 }}>
      {backHref ? (
        <button type="button" onClick={backHref} className="app-icon-btn" aria-label={t("backToSignIn")}><IconBack /></button>
      ) : (
        <Link href="/app/boas-vindas" className="app-icon-btn" aria-label={ta("back")}><IconBack /></Link>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>{subtitle}</p>
      </div>

      {(mode === "login" || mode === "cadastro") && (
        <>
          <button type="button" onClick={handleGoogle} disabled={loading} className="app-btn app-btn--light">
            <IconGoogle />{t("withGoogle")}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--muted2)", fontSize: 12, fontWeight: 600 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
            {ta("orEmail")}
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
          </div>

          <form onSubmit={handleCredentials} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "cadastro" && (
              <Field id="name" label={t("name")}>
                <input id="name" className="app-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}
            <Field id="email" label={t("email")}>
              <input id="email" type="email" inputMode="email" autoComplete="email" className="app-input"
                placeholder={ta("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field
              id="senha"
              label={mode === "cadastro" ? t("newPassword") : t("password")}
              aside={mode === "login" ? (
                <button type="button" onClick={() => go("forgot")} style={linkBtn}>{ta("forgotShort")}</button>
              ) : null}
            >
              <input id="senha" type="password" className="app-input" minLength={mode === "cadastro" ? 8 : undefined}
                autoComplete={mode === "cadastro" ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && <p role="alert" style={errStyle}>{error}</p>}
            <button type="submit" disabled={loading} className="app-btn app-btn--primary" style={{ marginTop: 4 }}>
              {loading ? t("signingIn") : mode === "cadastro" ? t("signUpButton") : t("signInButton")}
            </button>
          </form>

          <button type="button" onClick={() => go("magic")} className="app-btn app-btn--surface" style={{ height: 48, fontSize: 14 }}>
            <IconMail />{t("magicLink")}
          </button>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", paddingTop: 8 }}>
            <button type="button" onClick={() => go(mode === "login" ? "cadastro" : "login")} style={{ ...linkBtn, color: "var(--accent)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              {mode === "login" ? t("toggleToSignUp") : t("toggleToSignIn")}
            </button>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted2)", textAlign: "center", lineHeight: 1.5 }}>
              {ta.rich("legal", {
                terms: (c) => <Link href="/termos" style={{ textDecoration: "underline" }}>{c}</Link>,
                privacy: (c) => <Link href="/privacidade" style={{ textDecoration: "underline" }}>{c}</Link>,
              })}
            </p>
          </div>
        </>
      )}

      {(mode === "forgot" || mode === "magic") && (
        <form onSubmit={mode === "forgot" ? handleForgot : handleMagic} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field id="email2" label={t("email")}>
            <input id="email2" type="email" inputMode="email" autoComplete="email" className="app-input"
              placeholder={ta("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && <p role="alert" style={errStyle}>{error}</p>}
          {notice && <p role="status" style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: "var(--surface)", fontSize: 14, lineHeight: 1.5 }}>{notice}</p>}
          <button type="submit" disabled={loading} className="app-btn app-btn--primary">
            {mode === "forgot" ? t("sendResetLink") : t("sendMagic")}
          </button>
        </form>
      )}
    </main>
  );
}

const linkBtn: React.CSSProperties = {
  font: "inherit", background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "var(--accent)", fontSize: 13, fontWeight: 600,
};
const errStyle: React.CSSProperties = { color: "#ff6b6b", fontSize: 13, margin: 0, textAlign: "center" };

function Field({ id, label, aside, children }: { id: string; label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label htmlFor={id} className="app-label">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}

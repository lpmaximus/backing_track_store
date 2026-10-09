"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { detectInAppBrowser, chromeIntentUrl, type InAppBrowser } from "@/src/lib/inAppBrowser";
import { gaEvent } from "@/src/lib/gaEvent";

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarForm />
    </Suspense>
  );
}

// Modos da tela. "login"/"cadastro" são as abas; os demais são telas de um
// passo só, abertas por link ("reset", "magicAuto") ou por botão.
type Mode = "login" | "cadastro" | "forgot" | "reset" | "magic" | "magicAuto";

const APP_NAMES: Record<Exclude<InAppBrowser, null>, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", line: "LINE",
  snapchat: "Snapchat", linkedin: "LinkedIn", twitter: "X",
};

// 16px é o mínimo para o Safari do iPhone NÃO dar zoom ao focar o campo.
// Com 14px (o valor anterior) a tela ampliava a cada toque no cadastro.
const inputStyle: React.CSSProperties = {
  padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border2)",
  background: "var(--surface2)", color: "var(--text)", fontSize: 16, outline: "none",
};

const noopSubscribe = () => () => {};

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "var(--muted)", fontSize: 13, textDecoration: "underline",
};

function EntrarForm() {
  // Router "cru" de propósito: o callbackUrl vem do proxy.ts já com o prefixo
  // de idioma resolvido (/en/setlists), então não deve passar pelo wrapper do
  // next-intl — ele prefixaria de novo.
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const resetToken = searchParams.get("reset");
  const magicToken = searchParams.get("magic");
  const t = useTranslations("signIn");
  const tc = useTranslations("common");

  // Todo CTA que promete "criar conta" / "começar grátis" precisa abrir
  // direto na aba de cadastro — sem isso a pessoa cai na aba de Entrar (com
  // campo de senha) e não percebe que precisa trocar de aba. Foi o que
  // aconteceu na campanha de tráfego de 15/08/2026: TikTok trouxe visitantes,
  // ninguém completou cadastro, e a causa era esta — não falta de CTA.
  const [mode, setMode] = useState<Mode>(
    magicToken ? "magicAuto"
      : resetToken ? "reset"
      : searchParams.get("tab") === "cadastro" ? "cadastro" : "login",
  );
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [notice,   setNotice]   = useState("");
  const [copied,   setCopied]   = useState(false);

  // Navegador embutido (Instagram/TikTok/Facebook): o Google bloqueia o
  // OAuth ali. Lido do UA só no cliente (no servidor é sempre null), sem
  // setState em efeito — o UA não muda durante a visita.
  const inApp: InAppBrowser = useSyncExternalStore(
    noopSubscribe,
    () => detectInAppBrowser(navigator.userAgent),
    () => null,
  );
  useEffect(() => {
    if (inApp) gaEvent("inapp_browser_blocked", { app: inApp });
  }, [inApp]);

  // Link de acesso recebido por e-mail: entra sozinho, sem clique.
  const magicTried = useRef(false);
  useEffect(() => {
    if (!magicToken || magicTried.current) return;
    magicTried.current = true;
    (async () => {
      const res = await signIn("magic-link", { token: magicToken, redirect: false });
      if (res?.error) {
        setError(t("magicInvalid"));
        setMode("magic");
      } else {
        gaEvent("login", { method: "magic_link" });
        router.push(callbackUrl);
      }
    })();
  }, [magicToken, callbackUrl, router, t]);

  function go(m: Mode) {
    setMode(m);
    setError("");
    setNotice("");
  }

  async function handleGoogle() {
    setLoading(true);
    gaEvent("login", { method: "google" });
    await signIn("google", { callbackUrl });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* sem clipboard (alguns webviews): o usuário copia pela barra do app */
    }
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "cadastro") {
      // event_id compartilhado entre o disparo client-side (ttq.track abaixo)
      // e o server-side (Events API, dentro de /api/auth/register) — é assim
      // que a TikTok deduplica os dois e conta 1 conversão, não 2. Ver
      // https://ads.tiktok.com/help/article/event-deduplication.
      const eventId = crypto.randomUUID();

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, eventId, locale }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? tc("error"));
        setLoading(false);
        return;
      }

      // Cadastro concluído — evento pro Pixel do TikTok (campanha de conversão).
      (window as unknown as {
        ttq?: { track: (e: string, props?: object, opts?: { event_id: string }) => void };
      }).ttq?.track("CompleteRegistration", {}, { event_id: eventId });
      gaEvent("sign_up", { method: "email" });
    }

    const result = await signIn("credentials", {
      email, password, redirect: false,
    });

    if (result?.error) {
      setError(t("invalidCredentials"));
      setLoading(false);
    } else {
      if (mode === "login") gaEvent("login", { method: "email" });
      // Conta nova sem destino definido vai direto para a 1ª separação — é o
      // momento em que o produto faz sentido. Em 09/10/2026, 12 de 13 contas
      // Free nunca tinham separado nada: caíam na home e não achavam o caminho.
      const isDefaultDestination = callbackUrl === "/" || callbackUrl === `/${locale}`;
      if (mode === "cadastro" && isDefaultDestination) {
        router.push(locale === "en" ? "/en/upload?welcome=1" : "/upload?welcome=1");
      } else {
        router.push(callbackUrl);
      }
    }
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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error === "invalid_token" ? t("resetInvalid") : tc("error"));
      return;
    }
    const result = await signIn("credentials", { email: data.email, password, redirect: false });
    if (result?.error) {
      setLoading(false);
      go("login");
    } else {
      router.push(callbackUrl);
    }
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale, callbackUrl }),
    });
    setLoading(false);
    if (res.status === 503) return setError(t("mailUnavailable"));
    if (!res.ok) return setError(tc("error"));
    setNotice(t("magicSent", { email }));
  }

  const isTab = mode === "login" || mode === "cadastro";
  const subtitle =
    mode === "login" ? t("title")
      : mode === "cadastro" ? t("signUpButton")
      : mode === "forgot" ? t("forgotTitle")
      : mode === "reset" ? t("resetTitle")
      : t("magicTitle");
  const comingToUpload = callbackUrl.includes("/upload");
  const intent = typeof window !== "undefined" && inApp ? chromeIntentUrl(window.location.href) : null;
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const errorLine = error && (
    <p style={{ color: "var(--danger)", fontSize: 13, margin: "4px 0 0", textAlign: "center" }}>{error}</p>
  );
  const noticeLine = notice && (
    <p style={{ color: "var(--text)", background: "var(--surface2)", borderRadius: 8, fontSize: 14, margin: 0, padding: "12px 14px", lineHeight: 1.5 }}>
      {notice}
    </p>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div className="signin-card" style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--surface)",
        border: "1px solid var(--border2)",
        borderRadius: 16,
        padding: "36px 32px",
      }}>
        {/* Logo — clamp: em 375px a palavra inteira passava da borda do card */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: "clamp(22px, 6.5vw, 28px)", fontWeight: 900, color: "var(--text)", marginBottom: 4, whiteSpace: "nowrap" }}>
            Backing<span style={{ color: "var(--accent)" }}>Track</span>.store
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{subtitle}</p>
        </div>

        {mode === "magicAuto" ? (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 15 }}>{t("signingIn")}</p>
        ) : (
          <>
            {comingToUpload && isTab && (
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)", background: "rgba(255,154,0,0.12)", border: "1px solid rgba(255,154,0,0.35)", borderRadius: 8, padding: "10px 12px", margin: "0 0 20px" }}>
                {t("uploadContext")}
              </p>
            )}

            {/* Tabs */}
            {isTab && (
              <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, padding: 3, marginBottom: 24 }}>
                {(["login", "cadastro"] as const).map(tabKey => (
                  <button key={tabKey} onClick={() => go(tabKey)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 6, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 14,
                      background: mode === tabKey ? "var(--surface3)" : "transparent",
                      color: mode === tabKey ? "var(--text)" : "var(--muted)",
                      transition: "all 0.15s",
                    }}>
                    {tabKey === "login" ? t("signInButton") : t("signUpButton")}
                  </button>
                ))}
              </div>
            )}

            {/* Google — ou, dentro de app (Instagram/TikTok), a instrução */}
            {isTab && (inApp ? (
              <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: "14px 14px", marginBottom: 20, background: "var(--surface2)" }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 6px", color: "var(--text)" }}>{t("inAppTitle")}</p>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 12px", color: "var(--muted)" }}>
                  {t("inAppText", { app: APP_NAMES[inApp] })}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={copyLink}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {copied ? t("linkCopied") : t("copyLink")}
                  </button>
                  {isAndroid && intent && (
                    <a href={intent}
                      style={{ padding: "10px 14px", borderRadius: 8, background: "var(--text)", color: "#fff", fontWeight: 600, fontSize: 13 }}>
                      {t("openInChrome")}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={handleGoogle} disabled={loading}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid var(--border2)",
                  background: "var(--surface2)", color: "var(--text)", fontWeight: 600, fontSize: 15,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  marginBottom: 20, minHeight: 46,
                }}>
                <span style={{ fontSize: 18 }}>G</span>
                {t("withGoogle")}
              </button>
            ))}

            {isTab && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ color: "var(--muted2)", fontSize: 12 }}>{t("or")}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
            )}

            {/* Formulários */}
            {isTab && (
              <form onSubmit={handleCredentials} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {mode === "cadastro" && (
                  <input type="text" name="name" autoComplete="name" placeholder={t("name")}
                    value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
                )}
                <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none"
                  placeholder={t("email")} value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                <input type="password" name="password"
                  autoComplete={mode === "cadastro" ? "new-password" : "current-password"}
                  placeholder={t("password")} value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} style={inputStyle} />
                {errorLine}
                <button type="submit" disabled={loading} className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "13px 0" }}>
                  {loading ? tc("loading") : mode === "login" ? t("signInButton") : t("signUpButton")}
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  <button type="button" onClick={() => go("magic")} style={linkBtn}>{t("magicLink")}</button>
                  {mode === "login" && (
                    <button type="button" onClick={() => go("forgot")} style={linkBtn}>{t("forgot")}</button>
                  )}
                </div>
              </form>
            )}

            {(mode === "forgot" || mode === "magic") && (
              <form onSubmit={mode === "forgot" ? handleForgot : handleMagic} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 4px" }}>
                  {mode === "forgot" ? t("forgotHint") : t("magicHint")}
                </p>
                {notice ? noticeLine : (
                  <>
                    <input type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none"
                      placeholder={t("email")} value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                    {errorLine}
                    <button type="submit" disabled={loading} className="btn-primary"
                      style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "13px 0" }}>
                      {loading ? tc("loading") : mode === "forgot" ? t("sendResetLink") : t("sendMagic")}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => go("login")} style={{ ...linkBtn, alignSelf: "center", marginTop: 4 }}>
                  {t("backToSignIn")}
                </button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="password" name="new-password" autoComplete="new-password"
                  placeholder={t("newPassword")} value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} style={inputStyle} />
                {errorLine}
                <button type="submit" disabled={loading} className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "13px 0" }}>
                  {loading ? tc("loading") : t("saveNewPassword")}
                </button>
                <button type="button" onClick={() => go("forgot")} style={{ ...linkBtn, alignSelf: "center", marginTop: 4 }}>
                  {t("forgot")}
                </button>
              </form>
            )}
          </>
        )}

        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", margin: "20px 0 0" }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "underline" }}>
            {tc("back")}
          </Link>
        </p>
      </div>
    </div>
  );
}

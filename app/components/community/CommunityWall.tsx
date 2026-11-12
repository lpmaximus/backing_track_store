"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { WALL_LIMITS_CLIENT as L } from "./limits";

type Post = {
  id: number;
  name: string;
  country: string | null;
  countryName: string | null;
  city: string | null;
  content: string;
  createdAt: string;
};

type Props = {
  locale: string;
  countries: string[];
  posts: Post[];
  countryOptions: { code: string; name: string }[];
  loggedIn: boolean;
  defaultName: string;
};

/**
 * Mural da home (client): recado fixo do fundador + recados aprovados +
 * formulário de 3 campos. Sem conta, sem captcha — o filtro é a moderação.
 */
export default function CommunityWall({ locale, countries, posts, countryOptions, loggedIn, defaultName }: Props) {
  const t = useTranslations("community");
  const [visitor, setVisitor] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState(""); // isca para robôs
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());

  // País do visitante: pré-seleciona o formulário e decide o convite
  // "seja o primeiro de X" × "junte-se a X".
  useEffect(() => {
    let alive = true;
    fetch("/api/community/where")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.country) return;
        setVisitor(d.country);
        setCountry((c) => c || d.country);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const visitorName = visitor ? countryOptions.find((o) => o.code === visitor)?.name ?? null : null;
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError(t("errorName")); return; }
    if (content.trim().length < L.contentMin) { setError(t("errorContent")); return; }
    setState("sending");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country, city, content, locale, website, filledMs: Date.now() - startedAt.current }),
      });
      if (res.status === 429) { setError(t("errorRate")); setState("idle"); return; }
      if (!res.ok) { setError(t("errorGeneric")); setState("idle"); return; }
      setState("sent");
      setContent("");
    } catch {
      setError(t("errorGeneric"));
      setState("idle");
    }
  }

  const label = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 } as const;
  const input = {
    width: "100%", fontSize: 15, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border2)",
    background: "var(--surface)", color: "var(--text)", fontFamily: "inherit",
  } as const;
  const cardBase = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" } as const;

  return (
    <div className="cm-grid" style={{ marginTop: 40 }}>
      {/* MURAL */}
      <div>
        <h3 style={{ fontSize: 13, letterSpacing: "0.12em", fontWeight: 800, color: "var(--muted2)", margin: "0 0 14px" }}>
          {t("wallTitle").toUpperCase()}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Recado fixo do fundador — assinado, não é depoimento de usuário. */}
          <article style={{ ...cardBase, background: "var(--text)", border: "1px solid var(--text)", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: 999, background: "var(--accent)", color: "#0D0D0F", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>L</span>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>
                  {t("founderName")}{" "}
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", background: "var(--accent)", color: "#0D0D0F", borderRadius: 999, padding: "2px 7px", verticalAlign: 2 }}>{t("founderBadge")}</span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa" }}>{t("founderPlace")}</div>
              </div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.65, color: "#e6e6e6" }}>{t("founderText")}</p>
          </article>

          {posts.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 2px" }}>{t("emptyWall")}</p>
          )}
          {posts.map((p) => (
            <article key={p.id} style={cardBase}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)" }}>
                  {p.name}
                  {(p.city || p.countryName) && (
                    <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 13 }}> · {[p.city, p.countryName].filter(Boolean).join(", ")}</span>
                  )}
                </div>
                <time dateTime={p.createdAt} style={{ fontSize: 11.5, color: "var(--muted2)" }}>{dateFmt.format(new Date(p.createdAt))}</time>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.65, color: "var(--text)", overflowWrap: "anywhere" }}>{p.content}</p>
            </article>
          ))}
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div>
        <div style={{ ...cardBase, padding: "24px 24px 22px", border: "1px solid var(--border2)", position: "sticky", top: 90 }}>
          {visitor && visitorName && (
            <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 700, color: "var(--accent2)", lineHeight: 1.5 }}>
              {countries.includes(visitor) ? t("joinFrom", { country: visitorName }) : t("firstFrom", { country: visitorName })}
            </p>
          )}
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>{t("formTitle")}</h3>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "8px 0 18px", lineHeight: 1.6 }}>{t("formHint")}</p>

          {state === "sent" ? (
            <div role="status" style={{ background: "var(--surface2)", borderRadius: 12, padding: "18px 18px" }}>
              <div style={{ fontWeight: 800, color: "var(--text)" }}>{t("sentTitle")}</div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 12px", lineHeight: 1.6 }}>{t("sentText")}</p>
              <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: "9px 16px" }}
                onClick={() => { setState("idle"); startedAt.current = Date.now(); }}>
                {t("sendAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="cm-name" style={label}>{t("name")}</label>
                <input id="cm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={L.name}
                  placeholder={t("namePh")} autoComplete="given-name" style={input} />
              </div>
              <div className="cm-row">
                <div>
                  <label htmlFor="cm-country" style={label}>{t("country")}</label>
                  <select id="cm-country" value={country} onChange={(e) => setCountry(e.target.value)} style={input}>
                    <option value="">{t("countryPick")}</option>
                    {countryOptions.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="cm-city" style={label}>{t("city")}</label>
                  <input id="cm-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={L.city}
                    placeholder={t("cityPh")} autoComplete="address-level2" style={input} />
                </div>
              </div>
              <div>
                <label htmlFor="cm-msg" style={label}>{t("message")}</label>
                <textarea id="cm-msg" value={content} onChange={(e) => setContent(e.target.value)} maxLength={L.contentMax}
                  placeholder={t("messagePh")} rows={4} style={{ ...input, resize: "vertical", minHeight: 104 }} />
                <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted2)", marginTop: 4 }}>{content.length}/{L.contentMax}</div>
              </div>
              {/* Isca: invisível para pessoas, robôs preenchem. */}
              <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
              {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={state === "sending"}
                style={{ fontSize: 15, padding: "13px 22px", justifyContent: "center", width: "100%" }}>
                {state === "sending" ? t("sending") : t("send")}
              </button>
              <p style={{ fontSize: 11.5, color: "var(--muted2)", margin: 0, lineHeight: 1.5 }}>{t("privacy")}</p>
            </form>
          )}

          {!loggedIn && (
            <Link href={{ pathname: "/entrar", query: { tab: "cadastro" } }}
              style={{ display: "block", marginTop: 16, fontSize: 13.5, fontWeight: 700, color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              {t("signupCta")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

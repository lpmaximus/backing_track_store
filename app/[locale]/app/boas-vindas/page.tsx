import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { Link, redirect } from "@/src/i18n/navigation";
import { BrandMark } from "../_components/AppIcons";

/** Boas-vindas — primeira tela de quem abre o app sem sessão (Welcome.dc.html). */
export default async function AppWelcome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user) redirect({ href: "/app", locale });

  const t = await getTranslations({ locale, namespace: "app.welcome" });

  // Onda decorativa: envelope senoidal, determinística (sem Math.random no SSR).
  const bars = Array.from({ length: 40 }, (_, i) => {
    const env = Math.sin((i / 39) * Math.PI);
    const h = 8 + Math.round(env * Math.abs(Math.sin(i * 0.9 + 0.4) * 0.6 + Math.cos(i * 0.37) * 0.4) * 180);
    return { h, o: 0.25 + env * 0.75 };
  });
  const chips = ["stems", "chords", "loops", "band", "stage"] as const;

  return (
    <main className="app-screen app-screen--bare" style={{ gap: 0, paddingLeft: 24, paddingRight: 24 }}>
      <div aria-hidden="true" style={{ minHeight: 240, flex: "0 1 300px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, margin: "0 -24px" }}>
        {bars.map((b, i) => (
          <div key={i} style={{ width: 5, borderRadius: 3, height: b.h, background: "var(--accent)", opacity: b.o }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandMark size={40} />
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1.2 }}>
            BACKING TRACK<br /><span style={{ color: "var(--accent)" }}>STORE</span>
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.015em" }}>{t("title")}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#a6a6ae" }}>{t("text")}</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <li key={c} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#c8c8ce", border: "1px solid var(--border2)", borderRadius: 999, padding: "6px 10px" }}>
              {t(`chips.${c}`)}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <Link href={{ pathname: "/app/entrar", query: { tab: "cadastro" } }} className="app-btn app-btn--primary" style={{ height: 54, fontSize: 16 }}>
          {t("signUp")}
        </Link>
        <Link href="/app/entrar" className="app-btn app-btn--ghost" style={{ height: 54 }}>
          {t("signIn")}
        </Link>
      </div>
    </main>
  );
}

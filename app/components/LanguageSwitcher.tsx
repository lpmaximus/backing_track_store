"use client";

import { useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { LANGUAGE_NAMES, locales, type Locale } from "@/src/i18n/routing";
import { LOCALE_COOKIE } from "@/src/i18n/geo";

/**
 * Combo box de idioma (Português / English / Español), preservando a rota
 * atual (/planos ⇄ /en/pricing ⇄ /es/precios).
 *
 * O sistema escolhe o idioma sozinho pelo país (ver src/i18n/geo.ts), mas a
 * escolha manual grava o cookie NEXT_LOCALE, que tem precedência sobre a
 * detecção no proxy.ts — quem prefere outro idioma escolhe uma vez e não é
 * mais redirecionado.
 *
 * Os nomes aparecem no próprio idioma ("Español", não "Espanhol"): quem caiu
 * no idioma errado precisa reconhecer o seu sem ler o resto da página.
 *
 * `variant="header"` é a versão compacta do cabeçalho; a padrão é a do rodapé.
 */
export default function LanguageSwitcher({
  variant = "default",
}: {
  variant?: "default" | "header" | "menu";
}) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  // Em rota dinâmica, `pathname` vem como padrão (/song/[slug]) — os valores
  // reais dos segmentos precisam vir à parte para remontar a URL traduzida.
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      // O cast é inevitável: o par (pathname, params) só se conhece em runtime,
      // então o TypeScript não tem como casar um com o outro aqui. É o padrão
      // recomendado pela própria documentação do next-intl para este componente.
      router.replace(
        { pathname, params } as Parameters<typeof router.replace>[0],
        { locale: next as Locale },
      );
    });
  }

  const compact = variant === "header";

  return (
    <label
      className={variant === "header" ? "lang-switcher lang-switcher-header" : "lang-switcher"}
      title={t("switch")}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: variant === "menu" ? "100%" : undefined,
      }}
    >
      {/* Globo: sinal universal de "idioma", reconhecível sem ler o texto. */}
      <svg
        width={compact ? 15 : 16}
        height={compact ? 15 : 16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ position: "absolute", left: compact ? 9 : 11, pointerEvents: "none", color: "var(--muted)" }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t("switch")}
        disabled={isPending}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border2)",
          borderRadius: compact ? 8 : 10,
          padding: compact ? "7px 26px 7px 29px" : "9px 30px 9px 34px",
          fontSize: 13,
          fontWeight: 600,
          cursor: isPending ? "wait" : "pointer",
          width: variant === "menu" ? "100%" : undefined,
          maxWidth: variant === "menu" ? undefined : 200,
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
      {/* Seta do combo — o appearance:none tira a nativa. */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden
        style={{ position: "absolute", right: compact ? 9 : 11, pointerEvents: "none", color: "var(--muted)" }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}

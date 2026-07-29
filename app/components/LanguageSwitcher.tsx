"use client";

import { useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { locales, type Locale } from "@/src/i18n/routing";

/**
 * Troca de idioma preservando a rota atual (/planos ⇄ /en/pricing).
 *
 * A escolha manual grava o cookie NEXT_LOCALE, que tem precedência sobre a
 * detecção por país no proxy.ts — quem mora fora do Brasil e prefere português
 * escolhe uma vez e não é mais redirecionado.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
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
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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

  return (
    <select
      value={locale}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("switch")}
      disabled={isPending}
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border2)",
        borderRadius: 10,
        padding: compact ? "6px 10px" : "8px 12px",
        fontSize: 13,
        cursor: isPending ? "wait" : "pointer",
        maxWidth: 200,
      }}
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </select>
  );
}

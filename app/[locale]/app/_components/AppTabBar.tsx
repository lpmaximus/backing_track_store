"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/src/i18n/navigation";
import { haptic } from "@/src/lib/native";
import { IconBand, IconHome, IconList, IconStudio, IconUser } from "./AppIcons";

/**
 * Barra inferior do app (5 abas, como no protótipo).
 *
 * Setlists, Banda e Conta ainda abrem as telas do site — as versões mobile
 * delas são a próxima rodada do app. O link é o mesmo de hoje, então nada
 * quebra quando a tela /app equivalente entrar: só troca o href aqui.
 */
export default function AppTabBar() {
  const t = useTranslations("app.tabs");
  const pathname = usePathname();

  const items = [
    { href: "/app" as const, label: t("home"), icon: <IconHome />, active: pathname === "/app" },
    { href: "/app/estudio" as const, label: t("studio"), icon: <IconStudio />, active: pathname.startsWith("/app/estudio") },
    { href: "/setlists" as const, label: t("setlists"), icon: <IconList />, active: pathname.startsWith("/setlists") },
    { href: "/bandas" as const, label: t("band"), icon: <IconBand />, active: pathname.startsWith("/bandas") },
    { href: "/conta" as const, label: t("account"), icon: <IconUser />, active: pathname.startsWith("/conta") },
  ];

  return (
    <nav className="app-tabbar" aria-label={t("aria")}>
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={it.active ? "page" : undefined} onClick={() => void haptic()}>
              {it.icon}
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

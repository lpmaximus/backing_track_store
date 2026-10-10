"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/src/i18n/navigation";
import { haptic } from "@/src/lib/native";
import { IconBand, IconHome, IconList, IconStudio, IconUser } from "./AppIcons";

/**
 * Barra inferior do app (5 abas, como no protótipo).
 *
 * Todas as abas ficam dentro da área /app (casca mobile). Recursos que ainda
 * só existem no site (editar repertório, modo palco) abrem a partir das telas.
 */
export default function AppTabBar() {
  const t = useTranslations("app.tabs");
  const pathname = usePathname();

  const items = [
    { href: "/app" as const, label: t("home"), icon: <IconHome />, active: pathname === "/app" },
    { href: "/app/estudio" as const, label: t("studio"), icon: <IconStudio />, active: pathname.startsWith("/app/estudio") },
    { href: "/app/setlists" as const, label: t("setlists"), icon: <IconList />, active: pathname.startsWith("/app/setlists") },
    { href: "/app/bandas" as const, label: t("band"), icon: <IconBand />, active: pathname.startsWith("/app/bandas") },
    { href: "/app/conta" as const, label: t("account"), icon: <IconUser />, active: pathname.startsWith("/app/conta") || pathname.startsWith("/app/mensagens") },
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

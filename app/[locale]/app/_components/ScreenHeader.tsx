"use client";

import { useRouter } from "@/src/i18n/navigation";
import { useTranslations } from "next-intl";
import { IconBack } from "./AppIcons";

/** Cabeçalho das telas internas: voltar + título (+ ação opcional à direita). */
export default function ScreenHeader({ title, subtitle, fallback = "/app", action }: {
  title?: string;
  subtitle?: string;
  fallback?: "/app" | "/app/setlists" | "/app/conta" | "/app/bandas";
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("app.player");
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        className="app-icon-btn"
        aria-label={t("back")}
        onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      >
        <IconBack />
      </button>
      <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
        {title && <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action ?? <span style={{ width: 44, flexShrink: 0 }} aria-hidden="true" />}
    </header>
  );
}

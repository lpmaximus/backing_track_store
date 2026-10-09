import type { Metadata, Viewport } from "next";
import NativeBridge from "./_components/NativeBridge";

/**
 * Área /app — as telas do app nativo (Capacitor, modo shell remoto).
 *
 * O app abre https://backingtrack.store/app num WebView; estas mesmas rotas
 * também funcionam num navegador de celular comum. Não é página de SEO:
 * noindex aqui vale para tudo abaixo.
 *
 * O tema escuro vem da classe .bts-app (app/globals.css), que redefine as
 * variáveis do site — por isso componentes reaproveitados (player, cifra)
 * ficam escuros sem precisar de uma segunda versão.
 */
export const metadata: Metadata = {
  title: "App",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BackingTrack" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D0D0F",
  colorScheme: "dark",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bts-app">
      {children}
      <NativeBridge />
    </div>
  );
}

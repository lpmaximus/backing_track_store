import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "BackingTrack.store — Cifras e Bases para Musicos",
  description: "Bases musicais profissionais com cifras interativas para musicos amadores e profissionais.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

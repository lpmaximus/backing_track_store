import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BackingTrack.store — Cifras e Bases para Músicos",
  description: "Bases musicais profissionais com cifras interativas para músicos amadores e profissionais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Verificação de App Links (Android) e Universal Links (iOS) do app nativo.
  // Servidas por rota de API porque dependem de env vars (impressão digital da
  // chave de assinatura / Team ID da Apple) — ver app/api/app/.
  async rewrites() {
    return [
      { source: "/.well-known/assetlinks.json", destination: "/api/app/assetlinks" },
      { source: "/.well-known/apple-app-site-association", destination: "/api/app/aasa" },
    ];
  },
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public URLs: https://pub-xxx.r2.dev/...
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        // R2 custom domains (caso configure domínio próprio futuramente)
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
      {
        // Foto de perfil do login Google (NextAuth)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;

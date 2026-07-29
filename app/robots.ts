import type { MetadataRoute } from "next";
import { siteUrl } from "@/src/lib/siteUrl";

// Next.js gera /robots.txt a partir deste arquivo (App Router).
// Durante a manutenção (MAINTENANCE_MODE=true o proxy redireciona tudo
// para /coming-soon) não faz sentido convidar o robô a rastrear — nesse
// caso devolvemos um disallow total para não indexar a página de espera.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  if (process.env.MAINTENANCE_MODE === "true") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // Rotas sem valor de busca ou que exigem sessão — nas duas línguas
  // (os slugs em inglês são outros: ver src/i18n/routing.ts).
  const privatePaths = [
    "/api/",
    "/admin/",
    "/coming-soon",
    "/en/coming-soon",
    // pt
    "/conta",
    "/perfil",
    "/upload",
    "/setlists",
    "/compartilhadas",
    "/entrar",
    "/bandas/entrar",
    // en
    "/en/account",
    "/en/my-songs",
    "/en/upload",
    "/en/setlists",
    "/en/shared",
    "/en/sign-in",
    "/en/bands/join",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

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

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Rotas sem valor de busca ou que exigem sessão.
        disallow: [
          "/api/",
          "/admin/",
          "/conta",
          "/perfil",
          "/upload",
          "/setlists",
          "/compartilhadas",
          "/entrar",
          "/bandas/entrar",
          "/coming-soon",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

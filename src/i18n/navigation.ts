/**
 * Wrappers de navegação cientes de idioma.
 *
 * IMPORTANTE: dentro de app/[locale] use SEMPRE estes imports no lugar de
 * "next/link" e "next/navigation". Eles resolvem o prefixo /en e os slugs
 * traduzidos automaticamente — um <Link href="/planos"> vira /en/pricing
 * quando o visitante está em inglês.
 *
 * O TypeScript valida o href contra o mapa de `pathnames`, então rota
 * inexistente vira erro de compilação, não link quebrado em produção.
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

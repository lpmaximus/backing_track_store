"use client";

import type { ComponentProps } from "react";
import { useEffect } from "react";
import { Link } from "@/src/i18n/navigation";
import { gaEvent } from "@/src/lib/gaEvent";

/**
 * Link do next-intl que dispara um evento do GA4 no clique. Existe para que
 * server components (home, catálogo) meçam os CTAs do funil sem virarem
 * client components inteiros.
 */
export default function TrackedLink({
  event, eventParams, onClick, ...props
}: ComponentProps<typeof Link> & { event: string; eventParams?: Record<string, unknown> }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        gaEvent(event, eventParams);
        onClick?.(e);
      }}
    />
  );
}

/** Dispara um evento uma vez, ao montar (ex.: busca sem resultado). */
export function GaOnMount({ event, eventParams }: { event: string; eventParams?: Record<string, unknown> }) {
  const key = JSON.stringify([event, eventParams]);
  useEffect(() => {
    gaEvent(event, eventParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

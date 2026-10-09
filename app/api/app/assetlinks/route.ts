import { NextResponse } from "next/server";

/**
 * /.well-known/assetlinks.json (via rewrite em next.config.ts)
 *
 * Diz ao Android que https://backingtrack.store/app/... pode abrir direto no
 * app store.backingtrack.app. Precisa da impressão digital SHA-256 do
 * certificado de assinatura — a da chave de upload E a da Play App Signing
 * (Play Console → Integridade do app), separadas por vírgula:
 *
 *   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...,CC:DD:...
 *
 * Sem a variável, devolve lista vazia: os links continuam abrindo no navegador.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));

  const body = prints.length
    ? [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "store.backingtrack.app", sha256_cert_fingerprints: prints },
      }]
    : [];

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

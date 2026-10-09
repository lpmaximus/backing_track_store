import { NextResponse } from "next/server";

/**
 * /.well-known/apple-app-site-association (via rewrite em next.config.ts)
 *
 * Universal Links do iOS: https://backingtrack.store/app/... abre no app.
 * Precisa do Team ID da conta Apple Developer:
 *
 *   APPLE_TEAM_ID=ABCDE12345
 *
 * E, no Xcode, a capability "Associated Domains" com applinks:backingtrack.store.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim();
  const appIds = /^[A-Z0-9]{10}$/.test(team) ? [`${team}.store.backingtrack.app`] : [];

  return NextResponse.json(
    {
      applinks: {
        details: appIds.length
          ? [{ appIDs: appIds, components: [{ "/": "/app/*" }, { "/": "/en/app/*" }] }]
          : [],
      },
    },
    { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } },
  );
}

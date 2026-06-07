import type { NextAuthConfig } from "next-auth";

/**
 * Config "edge-safe" — SEM imports de banco de dados (Neon/Drizzle).
 * Usada pelo middleware (Edge Runtime), onde módulos que abrem conexão
 * com o Postgres no topo do arquivo (ex.: src/db/index.ts) quebram com
 * "No database connection string was provided to neon()".
 *
 * A config completa (com provider Credentials + callbacks que tocam o
 * banco) fica em auth.ts, que estende esta aqui apenas em runtime Node.js.
 */
export const authConfig: NextAuthConfig = {
  providers: [],

  session: { strategy: "jwt" },

  callbacks: {
    async session({ session, token }) {
      if (token) {
        (session.user as unknown as { id: string; role: string }).id   = token.id as string;
        (session.user as unknown as { id: string; role: string }).role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn:  "/entrar",
    signOut: "/",
    error:   "/entrar",
  },
};

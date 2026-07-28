import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db, users } from "@/src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { expireTrialIfDue } from "@/src/lib/trials";
import { track } from "@/src/lib/activity";

// Conta impedida de logar: suspensa, banida ou em processo de exclusão (R3).
function isLoginBlocked(u: { status?: string | null; deletionScheduledAt?: Date | null }): boolean {
  return u.status === "blocked" || u.status === "banned" || Boolean(u.deletionScheduledAt);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Email e senha",
      credentials: {
        email:    { label: "Email",  type: "email" },
        password: { label: "Senha",  type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        // Conta suspensa/banida ou marcada para exclusão não loga (R3).
        if (isLoginBlocked(user)) return null;
        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Upsert user na nossa tabela
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email!))
          .limit(1);

        if (!existing) {
          await db.insert(users).values({
            email:      user.email!,
            name:       user.name ?? null,
            image:      user.image ?? null,
            provider:   "google",
            providerId: user.id,
            role:       "free",
          });
        } else if (isLoginBlocked(existing)) {
          // Conta suspensa/banida ou em exclusão não entra via Google (R3).
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user || trigger === "update") {
        // Primeiro login (ou refresh explícito) — carregar role do banco.
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email!))
          .limit(1);
        if (dbUser) {
          token.id = String(dbUser.id);
          // Analytics de produto: marca a entrada no sistema. Só no primeiro
          // login/refresh do token, não em toda requisição. Best effort.
          if (user) void track(dbUser.id, "login");
          // Trial de convite vencido rebaixa aqui também, não só no cron:
          // garante que ninguém siga Pro se /api/jobs/trials falhar.
          if (dbUser.trialPlan && dbUser.trialEndsAt && dbUser.trialEndsAt.getTime() <= Date.now()) {
            await expireTrialIfDue(dbUser.id);
            token.role = dbUser.trialPreviousRole ?? "free";
          } else {
            token.role = dbUser.role;
          }
        }
      }
      return token;
    },
  },
});

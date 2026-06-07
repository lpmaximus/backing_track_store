import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db, users } from "@/src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

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
        }
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        // Primeiro login — carregar role do banco
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email!))
          .limit(1);
        if (dbUser) {
          token.id   = String(dbUser.id);
          token.role = dbUser.role;
        }
      }
      if (trigger === "update") {
        // Atualizar role quando assinatura mudar
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email!))
          .limit(1);
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
  },
});

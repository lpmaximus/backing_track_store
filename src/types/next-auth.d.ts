import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id:    string;
      email: string;
      name:  string | null;
      image: string | null;
      role:  string;
      // Conta de teste interno (ver src/lib/internalTest.ts) — nunca carrega o
      // e-mail em si até o client, só este booleano.
      isInternalTester?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?:   string;
    role?: string;
    isInternalTester?: boolean;
  }
}

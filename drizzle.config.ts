import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit não carrega .env.local automaticamente (isso é comportamento do Next.js)
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

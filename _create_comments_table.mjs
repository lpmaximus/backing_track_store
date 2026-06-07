import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: process.argv[2] });

const sql = neon(process.env.DATABASE_URL);

const stmt = `
CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "song_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "comments_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE,
  CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
`;

await sql(stmt);
console.log("OK: tabela comments criada (ou ja existia).");

const check = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'comments' ORDER BY ordinal_position;`;
console.log(check);

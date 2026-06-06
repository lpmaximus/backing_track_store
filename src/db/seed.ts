/**
 * Seed: importa songs.json → tabela songs no Neon PostgreSQL
 * Uso: npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { songs } from "./schema";
import songsData from "../../data/songs.json";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("🌱 Iniciando seed de músicas...");

  for (const s of songsData) {
    try {
      await db
        .insert(songs)
        .values({
          slug: s.slug,
          title: s.title,
          artist: s.artist,
          genre: s.genre,
          key: s.key,
          bpm: s.bpm,
          duration: s.duration ?? 0,
          audioUrl: s.audioFile || null,
          cifraText: s.cifra || null,
          chords: null,
          published: true,
        })
        .onConflictDoNothing(); // ignora se slug já existe

      console.log(`  ✅ ${s.title} — ${s.artist}`);
    } catch (err) {
      console.error(`  ❌ Erro ao inserir "${s.title}":`, err);
    }
  }

  console.log("\n✅ Seed concluído!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

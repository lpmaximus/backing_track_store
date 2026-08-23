/**
 * Retenção do mix original enviado pelo usuário (EVT 5.1) — agora ADIADA.
 *
 * Antes o webhook de separação apagava o mix do R2 no mesmo instante em que a
 * separação terminava, e SÓ DEPOIS submetia a detecção de cifra. Resultado: a
 * cifra nunca teve o mix disponível e era obrigada a rodar sobre um stem.
 *
 * Agora o mix sobrevive enquanto houver job de cifra lendo aquele arquivo — o
 * Replicate baixa o áudio quando a predição começa, que pode ser minutos depois
 * do submit. Assim que o job de cifra termina (aqui, no /api/chords/advance ou
 * no cron /api/jobs/finalize), o mix é apagado e `audioUrl` volta a NULL, como
 * a política sempre previu. Só o instante da exclusão mudou.
 */
import { db, songs, stems, processingJobs } from "@/src/db";
import { and, eq, inArray } from "drizzle-orm";
import { deleteObject, keyFromPublicUrl } from "@/src/lib/r2";

/**
 * Apaga o mix original de uma música de upload, se ninguém mais precisa dele.
 * Idempotente e best-effort: nunca lança, e devolve false quando ainda não é hora.
 */
export async function purgeSourceMix(songId: number): Promise<boolean> {
  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    // Catálogo (source_type = admin) mantém o mix — a retenção só vale p/ upload.
    if (!song || song.sourceType !== "user_upload" || !song.audioUrl) return false;

    // Job de cifra ainda em pé = o Replicate pode não ter baixado o áudio ainda.
    const busy = await db
      .select({ id: processingJobs.id })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.songId, songId),
          eq(processingJobs.stage, "chord_detection"),
          inArray(processingJobs.status, ["pending", "running"]),
        ),
      )
      .limit(1);
    if (busy.length > 0) return false;

    // Trava de segurança: sem stems, o mix é o ÚNICO áudio da música. Apagá-lo
    // deixaria a faixa muda. Só faz sentido descartar o original depois que a
    // separação de fato produziu as faixas que o player reconstrói.
    const hasStems = await db
      .select({ id: stems.id })
      .from(stems)
      .where(eq(stems.songId, songId))
      .limit(1);
    if (hasStems.length === 0) return false;

    const key = keyFromPublicUrl(song.audioUrl);
    if (key) {
      try {
        await deleteObject(key);
      } catch (err) {
        console.error("[retention] falha ao apagar mix original", songId, err);
      }
    }
    await db.update(songs).set({ audioUrl: null }).where(eq(songs.id, songId));
    return true;
  } catch (err) {
    console.error("[retention] purgeSourceMix", songId, err);
    return false;
  }
}

/**
 * Cliente R2 (Cloudflare) compartilhado + helpers de presigned URL e deleção.
 * Centraliza o que antes estava inline em app/api/admin/upload-url/route.ts,
 * agora reutilizado também pelo upload do usuário final (Fase 1.5).
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

/** Gera presigned PUT URL (upload direto browser → R2) e a URL pública final. */
export async function presignPut(key: string, contentType: string, expiresIn = 900) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(R2, command, { expiresIn });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { uploadUrl, publicUrl };
}

/** Deleta um objeto do R2 pela key. Usado para remover o mix original após o pipeline. */
export async function deleteObject(key: string) {
  await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Baixa um arquivo de uma URL externa (ex.: saída do Replicate) e sobe pro R2,
 * retornando a URL pública permanente. Usado pra não depender de URLs
 * temporárias/de terceiro (que expiram ou têm CORS bloqueado) — os stems
 * precisam ficar hospedados no nosso próprio bucket, igual ao mix original.
 */
export async function putObjectFromUrl(key: string, sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Falha ao baixar ${sourceUrl}: ${res.status}`);
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  const body = new Uint8Array(await res.arrayBuffer());

  await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/** Extrai a key R2 a partir de uma URL pública (inverso de presignPut). */
export function keyFromPublicUrl(publicUrl: string): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base || !publicUrl.startsWith(base)) return null;
  return publicUrl.slice(base.length).replace(/^\//, "");
}

/** Sanitiza uma key: só permite prefixos conhecidos e caracteres seguros. */
export function sanitizeKey(key: string): string | null {
  const safe = key.replace(/[^a-zA-Z0-9/_.\-]/g, "");
  if (!safe.startsWith("audio/") && !safe.startsWith("images/")) return null;
  return safe;
}

/**
 * POST /api/admin/upload-url
 * Gera uma presigned URL do Cloudflare R2 para upload direto (admin → R2, sem passar pelo Vercel).
 *
 * Body: { key: string; contentType: string }
 * Response: { uploadUrl: string; publicUrl: string }
 *
 * Uso no admin:
 *   1. POST /api/admin/upload-url → recebe uploadUrl e publicUrl
 *   2. PUT uploadUrl com o arquivo (fetch diretamente do browser)
 *   3. Salva publicUrl no campo audioUrl da música
 */
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  // Auth
  if (req.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { key, contentType } = await req.json();

  if (!key || !contentType) {
    return NextResponse.json(
      { error: "key e contentType são obrigatórios" },
      { status: 400 }
    );
  }

  // Sanitize key: permite audio/ e images/ como prefixos válidos
  const safeKey = key.replace(/[^a-zA-Z0-9/_.\-]/g, "");
  if (!safeKey.startsWith("audio/") && !safeKey.startsWith("images/")) {
    return NextResponse.json(
      { error: "key deve começar com 'audio/' ou 'images/'" },
      { status: 400 }
    );
  }

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
      ContentType: contentType,
    });

    // URL válida por 15 minutos
    const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 900 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${safeKey}`;

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload-url]", err);
    return NextResponse.json(
      { error: "Erro ao gerar URL de upload" },
      { status: 500 }
    );
  }
}

# Setup — FASE 0

Passos que você precisa executar **uma vez** para ativar a infraestrutura.

---

## 1. Instalar dependências

```bash
npm install
```

---

## 2. Criar banco no Neon

1. Acesse https://console.neon.tech e crie uma conta (grátis)
2. Crie um projeto → anote a **Connection string** (formato `postgresql://...`)

---

## 3. Criar bucket no Cloudflare R2

1. Acesse https://dash.cloudflare.com → **R2** → **Create bucket** → nome: `audio`
2. No bucket criado → **Settings** → **Public Access** → habilite e anote a URL pública (`https://pub-xxx.r2.dev`)
3. Gere credenciais em: **R2** → **Manage R2 API Tokens** → **Create API Token** (Object Read & Write no bucket `audio`)
4. Anote: Account ID, Access Key ID, Secret Access Key

---

## 4. Criar o `.env.local`

Copie o exemplo e preencha com os dados obtidos:

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:

```
DATABASE_URL=postgresql://neondb_owner:SUA_SENHA@ep-red-glitter-aq7pqp5g.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=audio
R2_PUBLIC_URL=https://pub-xxx.r2.dev
ADMIN_PASSWORD=sua-senha-segura
```

---

## 5. Criar as tabelas no banco

```bash
npm run db:push
```

Isso aplica o schema Drizzle direto no Neon sem precisar de migrações.

---

## 6. Importar músicas do songs.json (seed)

```bash
npm run db:seed
```

As 3 músicas de exemplo são inseridas no banco.

---

## 7. Rodar localmente

```bash
npm run dev
```

Acesse http://localhost:3000

---

## 8. Deploy no Vercel

1. Crie conta em https://vercel.com e conecte ao repositório GitHub
2. Em **Settings → Environment Variables**, adicione todas as vars do `.env.local`
3. Push para `main` → deploy automático

---

## Estrutura de arquivos criados na FASE 0

```
src/
  db/
    schema.ts    ← tabelas: songs, stems, users, subscriptions
    index.ts     ← cliente Drizzle/Neon
    seed.ts      ← importa songs.json → banco
drizzle.config.ts
app/
  api/
    songs/route.ts              ← CRUD REST (lê do banco)
    admin/upload-url/route.ts   ← presigned URL para R2
  admin/page.tsx                ← admin com upload de áudio
```

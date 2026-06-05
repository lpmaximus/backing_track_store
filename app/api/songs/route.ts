import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const SONGS_PATH = path.join(process.cwd(), "data", "songs.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "backingtrack2026";

function getSongs() {
  const raw = readFileSync(SONGS_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function GET() {
  try {
    const songs = getSongs();
    return NextResponse.json(songs);
  } catch {
    return NextResponse.json({ error: "Erro ao ler músicas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, song } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    const songs = getSongs();

    if (song.id) {
      // Update
      const idx = songs.findIndex((s: { id: string }) => s.id === song.id);
      if (idx !== -1) {
        songs[idx] = song;
      } else {
        songs.push(song);
      }
    } else {
      // Create
      const newSong = {
        ...song,
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
      };
      songs.push(newSong);
    }

    writeFileSync(SONGS_PATH, JSON.stringify(songs, null, 2));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { password, id } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    const songs = getSongs();
    const updated = songs.filter((s: { id: string }) => s.id !== id);
    writeFileSync(SONGS_PATH, JSON.stringify(updated, null, 2));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}

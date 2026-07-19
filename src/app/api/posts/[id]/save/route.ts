import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUserInterests } from "@/lib/recommendation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const postId = (await params).id;
    const body = await req.json().catch(() => ({}));
    const requestedPlaylistId = body.playlistId;

    let targetPlaylistId = requestedPlaylistId;

    if (!targetPlaylistId) {
      let defaultPlaylist = await prisma.playlist.findFirst({
        where: { userId: session.user.id, name: "Post Salvati" },
      });

      if (!defaultPlaylist) {
        defaultPlaylist = await prisma.playlist.create({
          data: {
            userId: session.user.id,
            name: "Post Salvati",
            isPrivate: true,
          },
        });
      }

      targetPlaylistId = defaultPlaylist.id;
    }

    const playlist = await prisma.playlist.findFirst({
      where: { id: targetPlaylistId, userId: session.user.id },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist non trovata" }, { status: 404 });
    }

    const existing = await prisma.savedPost.findUnique({
      where: { playlistId_postId: { playlistId: targetPlaylistId, postId } },
    });

    if (existing) {
      await prisma.savedPost.delete({ where: { id: existing.id } });
      return NextResponse.json({ saved: false });
    }

    await prisma.savedPost.create({
      data: {
        playlistId: targetPlaylistId,
        postId,
      },
    });

    // Aggiorna gli interessi dell'utente in background (non bloccare)
    updateUserInterests(session.user.id, postId, "save");

    return NextResponse.json({ saved: true, playlistId: targetPlaylistId });
  } catch (error) {
    console.error("Save post error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const postId = (await params).id;

    const savedPlaylists = await prisma.savedPost.findMany({
      where: {
        postId,
        playlist: { userId: session.user.id },
      },
      include: {
        playlist: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(savedPlaylists.map((s) => s.playlist));
  } catch (error) {
    console.error("Saved playlists error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

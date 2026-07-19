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
    const playlistId = (await params).id;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        posts: {
          include: {
            post: {
              include: {
                user: true,
                media: { orderBy: { order: "asc" } },
                keywords: true,
                _count: { select: { likes: true, comments: true, views: true, shares: true } },
                likes: session?.user?.id ? { where: { userId: session.user.id } } : undefined,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist non trovata" }, { status: 404 });
    }

    if (playlist.isPrivate && playlist.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const posts = playlist.posts.map((saved) => ({
      id: saved.post.id,
      caption: saved.post.caption,
      location: saved.post.location,
      isAiGenerated: saved.post.isAiGenerated,
      isUnavailable: saved.post.isUnavailable,
      expiresAt: saved.post.expiresAt,
      keywords: saved.post.keywords.map((k) => k.keyword),
      createdAt: saved.post.createdAt,
      user: saved.post.user,
      media: saved.post.media,
      likedByMe: saved.post.likes && saved.post.likes.length > 0,
      likesCount: saved.post._count.likes,
      commentsCount: saved.post._count.comments,
      viewsCount: saved.post._count.views,
      sharesCount: saved.post._count.shares,
    }));

    return NextResponse.json({ ...playlist, posts });
  } catch (error) {
    console.error("Playlist error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const playlistId = (await params).id;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist non trovata" }, { status: 404 });
    }

    if (playlist.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    await prisma.playlist.delete({ where: { id: playlistId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete playlist error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

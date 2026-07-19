import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPostExpiration } from "@/lib/post-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const postId = (await params).id;

    const includeLikes = session?.user?.id
      ? { where: { userId: session.user.id } }
      : undefined;

    const savedByMe = session?.user?.id
      ? await prisma.savedPost.findFirst({
          where: { postId, playlist: { userId: session.user.id } },
        })
      : null;

    let post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: true,
        media: { orderBy: { order: "asc" } },
        keywords: true,
        _count: { select: { likes: true, comments: true, views: true, shares: true } },
        likes: includeLikes,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    const isOwner = session?.user?.id === post.userId;
    if (!isOwner && post.visibility !== "public") {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    post = await checkPostExpiration(post.id, session?.user?.id);

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    return NextResponse.json({
      id: post.id,
      caption: post.caption,
      location: post.location,
      isAiGenerated: post.isAiGenerated,
      isUnavailable: post.isUnavailable,
      expiresAt: post.expiresAt,
      keywords: post.keywords.map((k) => k.keyword),
      createdAt: post.createdAt,
      user: post.user,
      media: post.media,
      likedByMe: post.likes && post.likes.length > 0,
      savedByMe: !!savedByMe,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewsCount: post._count.views,
      sharesCount: post._count.shares,
    });
  } catch (error) {
    console.error("Get post error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

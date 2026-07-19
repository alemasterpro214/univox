import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    const existingShare = await prisma.share.findUnique({
      where: { userId_postId: { userId: session.user.id, postId } },
    });

    if (!existingShare) {
      await prisma.share.create({
        data: {
          userId: session.user.id,
          postId,
        },
      });
    }

    const count = await prisma.share.count({
      where: { postId },
    });

    if (post.userId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "share",
          fromUserId: session.user.id,
          postId,
        },
      });
    }

    return NextResponse.json({ shared: true, sharesCount: count });
  } catch (error) {
    console.error("Share post error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

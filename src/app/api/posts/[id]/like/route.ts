import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUserInterests } from "@/lib/recommendation";
import { checkUserRestrictions } from "@/lib/moderation";
import { emitToPost, emitToUser } from "@/lib/realtime";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const restrictions = await checkUserRestrictions(session.user.id);
    if (restrictions.banned) {
      return NextResponse.json({ error: "Account bannato" }, { status: 403 });
    }
    if (!restrictions.canLike) {
      return NextResponse.json({ error: "Non puoi mettere like al momento" }, { status: 403 });
    }

    const postId = (await params).id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    if (post.userId === session.user.id) {
      return NextResponse.json({ error: "Non puoi mettere mi piace ai tuoi post" }, { status: 400 });
    }

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: session.user.id, postId } },
    });

    if (existing) {
    await prisma.like.delete({
      where: { id: existing.id },
    });

    const likesCount = await prisma.like.count({ where: { postId } });

    await emitToPost(postId, "post_liked", { postId, likesCount });

    return NextResponse.json({ liked: false, likesCount });
    }

    await prisma.like.create({
      data: {
        userId: session.user.id,
        postId,
      },
    });

    let notification: any = null;
    if (post) {
      notification = await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "like",
          fromUserId: session.user.id,
          postId,
        },
        include: { fromUser: true },
      });
    }

    const likesCount = await prisma.like.count({ where: { postId } });

    // Aggiorna gli interessi dell'utente in background (non bloccare)
    updateUserInterests(session.user.id, postId, "like");

    await emitToPost(postId, "post_liked", { postId, likesCount });
    if (notification && post) {
      await emitToUser(post.userId, "new_notification", notification);
    }

    return NextResponse.json({ liked: true, likesCount });
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

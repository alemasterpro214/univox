import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkUserRestrictions, moderateText } from "@/lib/moderation";
import { emitToPost, emitToUser } from "@/lib/realtime";
import { z } from "zod";

const commentSchema = z.object({
  text: z.string().max(1000).default(""),
  parentId: z.string().optional(),
  gifUrl: z.string().max(1000).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const postId = (await params).id;
    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const postId = (await params).id;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const restrictions = await checkUserRestrictions(session.user.id);
    if (restrictions.banned) {
      return NextResponse.json({ error: "Account bannato" }, { status: 403 });
    }
    if (!restrictions.canComment) {
      return NextResponse.json({ error: "Non puoi commentare al momento" }, { status: 403 });
    }

    const body = await req.json();
    const data = commentSchema.parse(body);

    // Se è un commento GIF, salta moderazione testo
    const isGif = !!data.gifUrl;
    if (!isGif) {
      const moderation = await moderateText(data.text);
      if (moderation.flagged) {
        return NextResponse.json(
          { error: "Commento non appropriato", reason: moderation.reason },
          { status: 403 }
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        userId: session.user.id,
        postId,
        text: data.text || "",
        gifUrl: data.gifUrl,
        parentId: data.parentId,
      },
      include: { user: true },
    });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    let notification: any = null;
    if (post && post.userId !== session.user.id) {
      notification = await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "comment",
          fromUserId: session.user.id,
          postId,
        },
        include: { fromUser: true },
      });
    }

    await emitToPost(postId, "post_commented", { postId, comment });
    if (notification && post) {
      await emitToUser(post.userId, "new_notification", notification);
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

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
    const userId = session.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    if (post.userId === userId) {
      const count = await prisma.postView.count({ where: { postId } });
      return NextResponse.json({ viewed: true, viewsCount: count });
    }

    const existingView = await prisma.postView.findFirst({
      where: { postId, userId },
    });

    if (!existingView) {
      await prisma.postView.create({
        data: { postId, userId },
      });

      // Aggiorna gli interessi dell'utente in background (non bloccare)
      updateUserInterests(userId, postId, "view");
    }

    const count = await prisma.postView.count({ where: { postId } });

    return NextResponse.json({ viewed: true, viewsCount: count });
  } catch (error) {
    console.error("View post error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

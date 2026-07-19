import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const visibilitySchema = z.object({
  visibility: z.enum(["public", "private", "close_friends"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const postId = (await params).id;
    const body = await req.json();
    const data = visibilitySchema.parse(body);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
    }

    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: { visibility: data.visibility },
    });

    return NextResponse.json({ visibility: updated.visibility });
  } catch (error) {
    console.error("Update visibility error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

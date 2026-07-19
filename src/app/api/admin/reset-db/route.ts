import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "Solo l'OWNER può resettare il database" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE_ALL_ACCOUNTS") {
      return NextResponse.json({ error: "Conferma non valida" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.hiddenMessage.deleteMany(),
      prisma.callParticipant.deleteMany(),
      prisma.call.deleteMany(),
      prisma.message.deleteMany(),
      prisma.conversationMember.deleteMany(),
      prisma.conversation.deleteMany(),
      prisma.share.deleteMany(),
      prisma.postView.deleteMany(),
      prisma.savedPost.deleteMany(),
      prisma.playlist.deleteMany(),
      prisma.storyView.deleteMany(),
      prisma.story.deleteMany(),
      prisma.reel.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.like.deleteMany(),
      prisma.postMedia.deleteMany(),
      prisma.postKeyword.deleteMany(),
      prisma.post.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.followRequest.deleteMany(),
      prisma.follow.deleteMany(),
      prisma.userInterest.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    return NextResponse.json({ success: true, message: "Tutti gli account sono stati eliminati" });
  } catch (error) {
    console.error("Reset DB error:", error);
    return NextResponse.json({ error: "Errore nel reset del database" }, { status: 500 });
  }
}

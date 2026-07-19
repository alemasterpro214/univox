import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitToConversation } from "@/lib/realtime";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const messageId = (await params).id;
    const { searchParams } = new URL(req.url);
    const forAll = searchParams.get("forAll") === "true";

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } },
    });

    if (!message) {
      return NextResponse.json({ error: "Messaggio non trovato" }, { status: 404 });
    }

    const isMember = message.conversation.members.some(
      (m) => m.userId === session.user.id
    );
    if (!isMember) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    if (forAll) {
      if (message.senderId !== session.user.id) {
        return NextResponse.json(
          { error: "Puoi eliminare per tutti solo i tuoi messaggi" },
          { status: 403 }
        );
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { isDeletedForAll: true, deletedAt: new Date() },
      });

      await emitToConversation(message.conversationId, "message_deleted", {
        messageId,
        forAll: true,
      });
    } else {
      const existing = await prisma.hiddenMessage.findUnique({
        where: {
          userId_messageId: {
            userId: session.user.id,
            messageId,
          },
        },
      });

      if (!existing) {
        await prisma.hiddenMessage.create({
          data: {
            userId: session.user.id,
            messageId,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

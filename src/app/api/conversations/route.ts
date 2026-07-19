import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const conversationSchema = z.object({
  userId: z.string(),
});

const groupConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  userIds: z.array(z.string()).min(2),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();

    // Group conversation
    if (body.userIds) {
      const { name, userIds } = groupConversationSchema.parse(body);
      const uniqueUserIds = Array.from(new Set([...userIds, session.user.id]));

      const newConversation = await prisma.conversation.create({
        data: {
          type: "group",
          name: name || undefined,
          members: {
            create: uniqueUserIds.map((userId) => ({ userId })),
          },
        },
      });

      return NextResponse.json({ id: newConversation.id }, { status: 201 });
    }

    const { userId } = conversationSchema.parse(body);

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Non puoi chattare con te stesso" }, { status: 400 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        type: "direct",
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId } } },
        ],
      },
      include: { members: true },
    });

    const conversation = conversations.find((c) => c.members.length === 2);

    if (conversation) {
      return NextResponse.json({ id: conversation.id });
    }

    const newConversation = await prisma.conversation.create({
      data: {
        type: "direct",
        members: {
          create: [{ userId: session.user.id }, { userId }],
        },
      },
    });

    return NextResponse.json({ id: newConversation.id }, { status: 201 });
  } catch (error) {
    console.error("Conversation error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

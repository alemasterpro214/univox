import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkUserRestrictions, moderateText } from "@/lib/moderation";
import { emitToConversation, emitToUser } from "@/lib/realtime";
import { z } from "zod";

const messageSchema = z.object({
  userId: z.string(),
  content: z.string().min(1),
  replyToId: z.string().optional(),
  type: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const withUserId = searchParams.get("with");
    const conversationId = searchParams.get("conversationId");

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          members: { some: { userId: session.user.id } },
        },
        include: {
          messages: {
            where: {
              NOT: {
                hiddenFor: { some: { userId: session.user.id } },
              },
            },
            include: { sender: true, replyTo: { include: { sender: true } } },
            orderBy: { createdAt: "asc" },
          },
          members: { include: { user: { select: { id: true, username: true, avatar: true, status: true, lastActiveAt: true, activeConversationId: true } } } },
        },
      });

      // Segna la conversazione come letta per l'utente corrente
      if (conversation) {
        await prisma.conversationMember.updateMany({
          where: { conversationId, userId: session.user.id },
          data: { lastReadAt: new Date() },
        });
      }

      return NextResponse.json(conversation || null);
    }

    if (withUserId) {
      const conversations = await prisma.conversation.findMany({
        where: {
          type: "direct",
          AND: [
            { members: { some: { userId: session.user.id } } },
            { members: { some: { userId: withUserId } } },
          ],
        },
        include: {
          messages: {
            include: { sender: true },
            orderBy: { createdAt: "asc" },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  status: true,
                  lastActiveAt: true,
                  activeConversationId: true,
                },
              },
            },
          },
        },
      });

      const conversation = conversations.find((c) => c.members.length === 2);

      return NextResponse.json(conversation || null);
    }

    const conversations = await prisma.conversation.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                status: true,
                lastActiveAt: true,
                activeConversationId: true,
              },
            },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const membership = conversation.members.find(
          (m) => m.userId === session.user.id
        );
        const lastReadAt = membership?.lastReadAt;

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: session.user.id },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        return { ...conversation, unreadCount };
      })
    );

    return NextResponse.json(conversationsWithUnread);
  } catch (error) {
    console.error("Messages error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const restrictions = await checkUserRestrictions(session.user.id);
    if (restrictions.banned) {
      return NextResponse.json({ error: "Account bannato" }, { status: 403 });
    }
    if (!restrictions.canMessage) {
      return NextResponse.json({ error: "Non puoi inviare messaggi al momento" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, content, replyToId, type } = messageSchema.parse(body);

    const skipModeration = type === "gif";
    if (!skipModeration) {
      const moderation = await moderateText(content);
      if (moderation.flagged) {
        return NextResponse.json(
          { error: "Messaggio non appropriato", reason: moderation.reason },
          { status: 403 }
        );
      }
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        type: "direct",
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId } } },
        ],
      },
      include: { members: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type: "direct",
          members: {
            create: [{ userId: session.user.id }, { userId }],
          },
        },
        include: { members: true },
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: session.user.id,
        content,
        type: type || "text",
        replyToId: replyToId || undefined,
      },
      include: { sender: true, replyTo: { include: { sender: true } } },
    });

    await Promise.all([
      emitToConversation(conversation.id, "new_message", message),
      emitToUser(userId, "new_notification", {
        type: "message",
        conversationId: conversation.id,
        message,
      }),
    ]);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

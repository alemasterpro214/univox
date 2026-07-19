import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitToCall, emitToUser } from "@/lib/realtime";
import { z } from "zod";

const createSchema = z.object({
  conversationId: z.string(),
  type: z.enum(["audio", "video"]),
  invitedUserIds: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  callId: z.string(),
  action: z.enum(["accept", "decline", "join", "leave", "end"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, type, invitedUserIds } = createSchema.parse(body);

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
      include: { conversation: { include: { members: { include: { user: true } } } } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const otherMembers = membership.conversation.members.filter(
      (m) => m.userId !== session.user.id
    );

    const invited =
      invitedUserIds && invitedUserIds.length > 0
        ? otherMembers.filter((m) => invitedUserIds.includes(m.userId))
        : otherMembers;

    if (invited.length === 0) {
      return NextResponse.json({ error: "Nessun utente da invitare" }, { status: 400 });
    }

    const call = await prisma.call.create({
      data: {
        conversationId,
        callerId: session.user.id,
        type,
        status: "ringing",
        participants: {
          create: [
            { userId: session.user.id, status: "joined", joinedAt: new Date() },
            ...invited.map((m) => ({ userId: m.userId, status: "invited" })),
          ],
        },
      },
      include: {
        caller: { select: { id: true, username: true, avatar: true } },
        participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      },
    });

    await Promise.all(
      invited.map((m) =>
        emitToUser(m.userId, "call:incoming", {
          call,
          caller: call.caller,
        })
      )
    );

    return NextResponse.json(call, { status: 201 });
  } catch (error) {
    console.error("Create call error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const { callId, action } = patchSchema.parse(body);

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        participants: true,
        conversation: { include: { members: true } },
      },
    });

    if (!call) {
      return NextResponse.json({ error: "Chiamata non trovata" }, { status: 404 });
    }

    const isMember = call.conversation.members.some((m) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const participant = call.participants.find((p) => p.userId === session.user.id);

    if (action === "end") {
      const updated = await prisma.call.update({
        where: { id: callId },
        data: {
          status: "ended",
          endedAt: new Date(),
        },
        include: {
          participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
        },
      });

      await emitToCall(callId, "call:ended", { callId });
      return NextResponse.json(updated);
    }

    if (!["accept", "decline", "join", "leave"].includes(action)) {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    let updateData: { status: string; joinedAt?: Date; leftAt?: Date } = { status: "" };
    if (action === "accept" || action === "join") {
      updateData = { status: "joined", joinedAt: new Date() };
    } else if (action === "decline") {
      updateData = { status: "declined" };
    } else if (action === "leave") {
      updateData = { status: "left", leftAt: new Date() };
    }

    if (participant) {
      await prisma.callParticipant.update({
        where: { id: participant.id },
        data: updateData,
      });
    } else {
      await prisma.callParticipant.create({
        data: {
          callId,
          userId: session.user.id,
          ...updateData,
        },
      });
    }

    // Activate call when someone accepts/joins
    if (action === "accept" || action === "join") {
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: "active",
          startedAt: call.startedAt || new Date(),
        },
      });
    }

    const updatedCall = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: { select: { id: true, username: true, avatar: true } },
        participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      },
    });

    await emitToCall(callId, "call:updated", { call: updatedCall });
    if (action === "accept" || action === "join") {
      await emitToCall(callId, "call:participant-joined", {
        callId,
        userId: session.user.id,
      });
    } else if (action === "decline") {
      await emitToCall(callId, "call:declined", {
        callId,
        userId: session.user.id,
      });
    } else if (action === "leave") {
      await emitToCall(callId, "call:participant-left", {
        callId,
        userId: session.user.id,
      });
    }

    return NextResponse.json(updatedCall);
  } catch (error) {
    console.error("Update call error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const callId = searchParams.get("callId");

    if (callId) {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          caller: { select: { id: true, username: true, avatar: true } },
          participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
        },
      });

      if (!call) {
        return NextResponse.json({ error: "Chiamata non trovata" }, { status: 404 });
      }

      const isParticipant = call.participants.some((p) => p.userId === session.user.id);
      if (!isParticipant) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
      }

      return NextResponse.json(call);
    }

    const calls = await prisma.call.findMany({
      where: {
        participants: { some: { userId: session.user.id } },
        status: { in: ["ringing", "active"] },
      },
      include: {
        caller: { select: { id: true, username: true, avatar: true } },
        participants: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(calls);
  } catch (error) {
    console.error("Get calls error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

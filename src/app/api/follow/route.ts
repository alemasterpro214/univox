import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitToUser } from "@/lib/realtime";
import { z } from "zod";

const followSchema = z.object({
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const { userId } = followSchema.parse(body);

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Non puoi seguire te stesso" }, { status: 400 });
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ following: false });
    }

    await prisma.follow.create({
      data: {
        followerId: session.user.id,
        followingId: userId,
      },
    });

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "follow",
        fromUserId: session.user.id,
      },
      include: { fromUser: true },
    });

    await emitToUser(userId, "new_notification", notification);

    return NextResponse.json({ following: true });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

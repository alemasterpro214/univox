import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const followRequestSchema = z.object({
  userId: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sent = searchParams.get("sent") === "true";

    const requests = await prisma.followRequest.findMany({
      where: sent
        ? { followerId: session.user.id, status: "pending" }
        : { followingId: session.user.id, status: "pending" },
      include: { follower: true, following: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Get follow requests error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const { userId } = followRequestSchema.parse(body);

    if (userId === session.user.id) {
      return NextResponse.json({ error: "Non puoi seguire te stesso" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json({ error: "Già segui questo utente" }, { status: 400 });
    }

    const existingRequest = await prisma.followRequest.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: userId,
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: "Richiesta già inviata" }, { status: 400 });
    }

    if (!targetUser.isPrivate) {
      return NextResponse.json({ error: "L'account è pubblico, usa il follow diretto" }, { status: 400 });
    }

    const request = await prisma.followRequest.create({
      data: {
        followerId: session.user.id,
        followingId: userId,
        status: "pending",
      },
      include: { follower: true },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "follow_request",
        fromUserId: session.user.id,
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error("Follow request error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

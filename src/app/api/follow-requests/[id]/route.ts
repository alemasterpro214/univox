import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
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

    const id = (await params).id;
    const body = await req.json();
    const { status } = updateSchema.parse(body);

    const request = await prisma.followRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
    }

    if (request.followingId !== session.user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    if (status === "accepted") {
      await prisma.$transaction([
        prisma.follow.create({
          data: {
            followerId: request.followerId,
            followingId: request.followingId,
          },
        }),
        prisma.followRequest.delete({
          where: { id },
        }),
      ]);

      await prisma.notification.create({
        data: {
          userId: request.followerId,
          type: "follow_accepted",
          fromUserId: session.user.id,
        },
      });

      return NextResponse.json({ success: true, status: "accepted" });
    }

    await prisma.followRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, status: "rejected" });
  } catch (error) {
    console.error("Update follow request error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

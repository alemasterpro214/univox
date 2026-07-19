import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const storySchema = z.object({
  url: z.string(),
  type: z.enum(["image", "video"]).default("image"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const now = new Date();

    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isVerified: true } },
        views: session?.user?.id
          ? { where: { userId: session.user.id }, select: { userId: true } }
          : false,
      },
      orderBy: { createdAt: "desc" },
    });

    const grouped: Record<string, any[]> = {};
    for (const story of stories) {
      if (!grouped[story.userId]) grouped[story.userId] = [];
      grouped[story.userId].push({
        id: story.id,
        url: story.url,
        type: story.type,
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
        viewedByMe: Array.isArray(story.views) && story.views.length > 0,
      });
    }

    const result = Object.values(grouped).map((group) => ({
      user: group[0]?.user,
      stories: group,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Stories error:", error);
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
    const data = storySchema.parse(body);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = await prisma.story.create({
      data: {
        userId: session.user.id,
        url: data.url,
        type: data.type,
        expiresAt,
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error("Create story error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

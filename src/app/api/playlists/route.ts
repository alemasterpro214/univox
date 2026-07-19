import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const playlistSchema = z.object({
  name: z.string().min(1).max(100),
  isPrivate: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const playlists = await prisma.playlist.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(playlists);
  } catch (error) {
    console.error("Playlists error:", error);
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
    const data = playlistSchema.parse(body);

    const playlist = await prisma.playlist.create({
      data: {
        userId: session.user.id,
        name: data.name,
        isPrivate: data.isPrivate,
      },
    });

    return NextResponse.json(playlist, { status: 201 });
  } catch (error) {
    console.error("Create playlist error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

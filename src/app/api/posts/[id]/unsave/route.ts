import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const postId = (await params).id;

    await prisma.savedPost.deleteMany({
      where: {
        postId,
        playlist: { userId: session.user.id },
      },
    });

    return NextResponse.json({ saved: false });
  } catch (error) {
    console.error("Unsave post error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

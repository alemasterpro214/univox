import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    let conversationId: string | null = null;
    try {
      const body = await req.json();
      conversationId = body?.conversationId || null;
    } catch {
      // Body opzionale: se non è JSON valido, aggiorniamo solo lastActiveAt.
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: new Date(),
        ...(conversationId ? { activeConversationId: conversationId } : { activeConversationId: null }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

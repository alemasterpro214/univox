import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["ONLINE", "DND", "OFFLINE"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const { status } = statusSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { status, lastActiveAt: new Date() },
      select: {
        id: true,
        username: true,
        status: true,
        lastActiveAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }
    console.error("Update status error:", error);
    return NextResponse.json({ error: "Errore nell'aggiornamento dello stato" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, lastActiveAt: true },
    });

    return NextResponse.json({ status: user?.status || "ONLINE", lastActiveAt: user?.lastActiveAt });
  } catch (error) {
    console.error("Get status error:", error);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}

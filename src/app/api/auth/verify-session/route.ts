import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !token.id || !token.activeSessionId) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { activeSessionId: true },
    });

    if (!user || user.activeSessionId !== token.activeSessionId) {
      return NextResponse.json({ valid: false }, { status: 403 });
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("Verify session error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

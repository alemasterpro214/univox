import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().max(200).optional(),
  avatar: z.string().max(1000).optional(),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(ip);
  if (!record || now > record.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith("/uploads/") ||
    url.startsWith("https://api.dicebear.com/")
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Troppe richieste" }, { status: 429 });
    }

    const body = await req.json();
    const data = updateProfileSchema.parse(body);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
    }

    if (data.avatar && !isValidAvatarUrl(data.avatar)) {
      return NextResponse.json({ error: "URL avatar non valido" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        website: true,
        avatar: true,
        isVerified: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Errore nell'aggiornamento del profilo" }, { status: 500 });
  }
}

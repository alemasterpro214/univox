import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/i, "Username può contenere solo lettere, numeri e underscore"),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

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

// Owner usernames that get auto-assigned OWNER role
const OWNER_USERNAMES = ["notalexagain"];

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Troppe richieste. Riprova tra qualche minuto." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    data.username = data.username.trim().toLowerCase();
    data.email = data.email.trim().toLowerCase();

    // Check for existing username OR email (dual check for safety)
    const [existingByUsername, existingByEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username: data.username } }),
      prisma.user.findUnique({ where: { email: data.email } }),
    ]);

    if (existingByUsername) {
      return NextResponse.json(
        { error: "Questo username è già in uso. Scegline un altro." },
        { status: 400 }
      );
    }

    if (existingByEmail) {
      return NextResponse.json(
        { error: "Questo indirizzo email è già registrato. Prova ad accedere." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Auto-assign OWNER role for specific usernames
    const isOwner = OWNER_USERNAMES.includes(data.username);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        name: data.name || data.username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}`,
        role: isOwner ? "OWNER" : "USER",
        isVerified: isOwner,
      },
    });

    return NextResponse.json(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof z.ZodError) {
      const firstError = (error as any).issues[0] || (error as any).errors[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Errore nella registrazione. Riprova." }, { status: 500 });
  }
}

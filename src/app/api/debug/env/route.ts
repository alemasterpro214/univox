import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TODO: rimuovere questo endpoint dopo aver risolto il problema di connessione.
const DEBUG_TOKEN = process.env.DEBUG_TOKEN || "unyvox-debug-2026";

function maskDatabaseUrl(url: string): string {
  if (!url.includes("@")) return url;
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timed out")), ms)
    ),
  ]);
}

export async function GET(request: Request) {
  const token = request.headers.get("x-debug-token");
  if (token !== DEBUG_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = process.env.DATABASE_URL || "NOT_SET";
  const maskedUrl = maskDatabaseUrl(rawUrl);

  let dbStatus = "unknown";
  let dbError: string | null = null;

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 5000);
    dbStatus = "connected";
  } catch (error) {
    dbStatus = "error";
    dbError = error instanceof Error ? error.message : String(error);
  }

  const response = {
    databaseUrl: maskedUrl,
    nodeEnv: process.env.NODE_ENV,
    dbStatus,
    dbError,
    timestamp: new Date().toISOString(),
  };

  console.log("[debug/env]", response);

  return NextResponse.json(response);
}

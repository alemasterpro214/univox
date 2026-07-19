import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export async function requireValidSession() {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.activeSessionId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeSessionId: true },
  });

  if (!user || user.activeSessionId !== session.user.activeSessionId) {
    return null;
  }

  return session;
}

function getClientIp(req?: { headers?: Headers | Record<string, string> | null }): string {
  if (!req) return "unknown";
  const headers = req.headers;
  if (!headers) return "unknown";

  const forwarded = typeof headers.get === "function" ? headers.get("x-forwarded-for") : (headers as Record<string, string>)["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = typeof headers.get === "function" ? headers.get("x-real-ip") : (headers as Record<string, string>)["x-real-ip"];
  if (realIp) return realIp;

  return "unknown";
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    if (key) acc[key] = decodeURIComponent(value || "");
    return acc;
  }, {} as Record<string, string>);
}

function getDeviceIdFromCookie(req?: { headers?: Headers | Record<string, string> | null }): string | null {
  if (!req) return null;
  const headers = req.headers;
  if (!headers) return null;
  const cookieHeader = typeof headers.get === "function" ? headers.get("cookie") : (headers as Record<string, string>)["cookie"];
  const cookies = parseCookies(cookieHeader);
  return cookies["unyvox-device-id"] || null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email o username", type: "text" },
        password: { label: "Password", type: "password" },
        deviceId: { label: "Device ID", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = credentials.email.trim().toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { username: identifier }],
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            username: true,
            role: true,
            passwordHash: true,
            bannedAt: true,
            deviceId: true,
            activeSessionId: true,
            lastIp: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        if (user.bannedAt) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) return null;

        // Genera una nuova sessione attiva per questo dispositivo
        const activeSessionId = randomUUID();
        const ip = getClientIp(req);
        const deviceId = getDeviceIdFromCookie(req);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            activeSessionId,
            lastIp: ip,
            deviceId: deviceId ?? user.deviceId,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          username: user.username,
          role: user.role,
          activeSessionId,
        };
      },
    }),
    CredentialsProvider({
      id: "ip-login",
      name: "IP Login",
      credentials: {
        deviceId: { label: "Device ID", type: "hidden" },
      },
      async authorize(_credentials, req) {
        const deviceId = getDeviceIdFromCookie(req);
        if (!deviceId) return null;

        const ip = getClientIp(req);

        const user = await prisma.user.findFirst({
          where: {
            AND: [{ lastIp: ip }, { deviceId }],
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            username: true,
            role: true,
            passwordHash: true,
            bannedAt: true,
            deviceId: true,
            activeSessionId: true,
            lastIp: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        if (user.bannedAt) return null;

        const activeSessionId = randomUUID();

        await prisma.user.update({
          where: { id: user.id },
          data: {
            activeSessionId,
            lastIp: ip,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          username: user.username,
          role: user.role,
          activeSessionId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.image = user.image;
        token.role = user.role;
        token.activeSessionId = user.activeSessionId;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const updatedSession = session as { image?: string };
        if (updatedSession.image) {
          token.image = updatedSession.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.image = token.image ?? undefined;
        session.user.role = token.role ?? undefined;
        session.user.activeSessionId = token.activeSessionId ?? undefined;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        try {
          await prisma.user.updateMany({
            where: {
              id: token.id as string,
              activeSessionId: token.activeSessionId as string | undefined,
            },
            data: { activeSessionId: null },
          });
        } catch (error) {
          console.error("SignOut event error:", error);
        }
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signin",
    error: "/auth/signin",
  },
};

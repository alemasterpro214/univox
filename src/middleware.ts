import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/auth/signin",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/default-avatar.png",
  "/uploads",
];

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    if (key) acc[key] = decodeURIComponent(value || "");
    return acc;
  }, {} as Record<string, string>);
}

function setDeviceCookie(response: NextResponse, deviceId: string) {
  response.cookies.set("unyvox-device-id", deviceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 anno
    secure: process.env.NODE_ENV === "production",
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Gestisci il cookie del dispositivo per tutte le richieste
  const cookies = parseCookies(req.headers.get("cookie"));
  let deviceId = cookies["unyvox-device-id"];
  if (!deviceId) {
    deviceId = crypto.randomUUID();
  }

  // Salta le risorse pubbliche e le API di autenticazione
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    if (!cookies["unyvox-device-id"]) {
      setDeviceCookie(response, deviceId);
    }
    return response;
  }

  // Salta le risorse statiche
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/default-avatar")
  ) {
    const response = NextResponse.next();
    if (!cookies["unyvox-device-id"]) {
      setDeviceCookie(response, deviceId);
    }
    return response;
  }

  // Verifica solo che esista un token JWT valido. Il controllo completo della
  // sessione (activeSessionId) viene delegato alle API e ai Server Components
  // per evitare self-fetch problematici nel middleware Edge.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Se non c'è token, le pagine pubbliche continuano a funzionare, le API
  // restituiscono 401 e le pagine protette vengono redirette al login.
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Redirect to login for protected pages, allow public pages to pass through.
    const isPublicPage = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";
    if (!isPublicPage) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
    const response = NextResponse.next();
    if (!cookies["unyvox-device-id"]) {
      setDeviceCookie(response, deviceId);
    }
    return response;
  }

  const response = NextResponse.next();
  if (!cookies["unyvox-device-id"]) {
    setDeviceCookie(response, deviceId);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|default-avatar).*)"],
};

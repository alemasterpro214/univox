import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
      activeSessionId?: string | null;
    };
  }

  interface User {
    id: string;
    username: string;
    role?: string | null;
    activeSessionId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    image?: string | null;
    role?: string | null;
    activeSessionId?: string | null;
  }
}

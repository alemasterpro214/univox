"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { SocketProvider } from "./SocketProvider";
import { IncomingCallProvider } from "./IncomingCallProvider";
import { LanguageProvider } from "@/lib/i18n";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SocketProvider>
          <IncomingCallProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </IncomingCallProvider>
        </SocketProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

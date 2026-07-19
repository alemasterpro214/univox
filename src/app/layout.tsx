import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeScript from "@/components/ThemeScript";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Unyvox",
  description: "A social media built with Next.js",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${geist.className} min-h-full bg-background text-foreground`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

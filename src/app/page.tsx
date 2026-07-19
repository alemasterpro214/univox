"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PostCard from "@/components/PostCard";
import StoryBar from "@/components/StoryBar";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/feed")
        .then((res) => res.json())
        .then((data) => {
          setPosts(data);
          setLoading(false);
        });
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Unyvox"
              width={36}
              height={36}
              className="object-contain"
              unoptimized
            />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Unyvox
            </span>
          </h1>
          {status === "authenticated" && (
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="p-2 text-muted hover:text-foreground transition"
              aria-label={t("feed.logoutAria")}
            >
              <LogOut size={22} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto">
        <StoryBar />
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p>{t("feed.noPosts")}</p>
              <p className="text-sm mt-2">{t("feed.followHint")}</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <PostCard key={post.id} post={post} priority={index === 0} />
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

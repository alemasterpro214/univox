"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { Search, Sparkles, UserPlus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Explore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  useEffect(() => {
    loadSuggestedUsers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const url = query.trim() ? `/api/explore?q=${encodeURIComponent(query.trim())}` : "/api/explore";
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
          setUsers(Array.isArray(data.users) ? data.users : []);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const loadSuggestedUsers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setSuggestedUsers(data);
    }
  };

  const handleFollow = async (userId: string) => {
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      loadSuggestedUsers();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder={t("explore.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-card text-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {query.trim() && users.length > 0 && (
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-sm mb-3 text-muted">
              {t("explore.topUsers")}
            </h2>
            <div className="space-y-2">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/users/${user.username}`}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-accent transition"
                >
                  <Image
                    src={user.avatar || "/default-avatar.png"}
                    alt={user.username}
                    width={40}
                    height={40}
                    sizes="40px"
                    unoptimized={user.avatar?.includes("svg") || user.avatar?.startsWith("/uploads/")}
                    className="rounded-full object-cover bg-muted/20"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{user.username}</p>
                    {user.name && <p className="text-xs text-muted truncate">{user.name}</p>}
                  </div>
                  <UserPlus size={18} className="text-muted" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {!query.trim() && suggestedUsers.length > 0 && (
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-sm mb-3 text-muted">
              {t("explore.suggested")}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {suggestedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex-shrink-0 w-32 bg-card rounded-xl p-3 text-center border border-border"
                >
                  <Link href={`/users/${user.username}`}>
                    <Image
                      src={user.avatar || "/default-avatar.png"}
                      alt={user.username}
                      width={60}
                      height={60}
                      sizes="60px"
                      unoptimized={user.avatar?.includes("svg") || user.avatar?.startsWith("/uploads/")}
                      className="rounded-full object-cover bg-muted/20 mx-auto mb-2"
                    />
                    <p className="font-semibold text-sm truncate text-foreground">
                      {user.username}
                    </p>
                  </Link>
                  <button
                    onClick={() => handleFollow(user.id)}
                    className="mt-2 w-full py-1.5 bg-accent text-accent-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition"
                  >
                    {t("explore.follow")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 p-1">
          {posts.map((post) => (
            <Link key={post.id} href={`/posts/${post.id}`}>
              <div className="aspect-square relative bg-muted/20">
                {post.media?.[0] &&
                  (post.media[0].type === "video" ? (
                    <video
                      src={post.media[0].url}
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={post.media[0].url}
                      alt="Post"
                      fill
                      sizes="(max-width: 768px) 33vw, 200px"
                      unoptimized={post.media[0]?.url?.startsWith('/uploads/')}
                      className="object-cover"
                    />
                  ))}
                {post.isAiGenerated && (
                  <div className="absolute top-1 right-1 bg-purple-500/80 text-white text-[10px] px-1 py-0.5 rounded flex items-center gap-0.5">
                    <Sparkles size={10} />
                    AI
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

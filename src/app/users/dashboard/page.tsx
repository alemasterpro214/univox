"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Heart, MessageCircle, Eye, Share2, FileText, Users, UserPlus, Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      loadDashboard();
    }
  }, [status, router]);

  const loadDashboard = async () => {
    setLoading(true);
    const res = await fetch("/api/users/dashboard");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setLoading(false);
  };

  const filteredPosts = useMemo(() => {
    return (
      stats?.posts?.filter((post: any) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (post.caption || "").toLowerCase().includes(query);
      }) || []
    );
  }, [stats?.posts, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/profile" className="text-foreground hover:text-accent transition">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="font-semibold text-lg">{t("dashboard.title")}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {stats && (
          <>
            {/* Header con benvenuto */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {t("dashboard.greeting")}, {session?.user?.name || session?.user?.username || t("dashboard.user")} 👋
              </h2>
              <p className="text-sm text-muted">{t("dashboard.statsDescription")}</p>
            </div>

            {/* Statistiche principali */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gradient-to-br from-pink-500/20 to-rose-500/10 rounded-2xl p-4 border border-pink-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-pink-500/20 rounded-xl">
                    <FileText size={20} className="text-pink-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.posts")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.totalPosts}</p>
              </div>
              <div className="bg-gradient-to-br from-red-500/20 to-orange-500/10 rounded-2xl p-4 border border-red-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-red-500/20 rounded-xl">
                    <Heart size={20} className="text-red-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.likes")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.totalLikes}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-xl">
                    <MessageCircle size={20} className="text-blue-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.comments")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.totalComments}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl p-4 border border-green-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-green-500/20 rounded-xl">
                    <Eye size={20} className="text-green-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.views")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.totalViews}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-violet-500/10 rounded-2xl p-4 border border-purple-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-xl">
                    <Share2 size={20} className="text-purple-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.shares")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.totalShares}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl p-4 border border-orange-500/20 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-orange-500/20 rounded-xl">
                    <Users size={20} className="text-orange-500" />
                  </div>                    <p className="text-muted text-sm">{t("dashboard.followers")}</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{stats.followersCount}</p>
              </div>
            </div>

            {/* Card seguiti */}
            <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-2xl p-4 border border-accent/20 mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/20 rounded-xl">
                  <UserPlus size={20} className="text-accent" />
                </div>
                <p className="text-muted text-sm">{t("dashboard.following")}</p>
                <p className="text-2xl font-bold text-foreground ml-auto">{stats.followingCount}</p>
              </div>
            </div>

            {/* Sezione post con ricerca */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">{t("dashboard.yourPosts")}</h2>
              <span className="text-xs text-muted bg-card px-2 py-1 rounded-full border border-border">
                {filteredPosts.length} {t("dashboard.of")} {stats.posts.length}
              </span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                placeholder={t("dashboard.searchPlaceholder")}
                aria-label={t("dashboard.searchAria")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-card border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition"
                  aria-label={t("dashboard.clearSearch")}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted bg-card rounded-2xl border border-border border-dashed">
                <Search size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t("dashboard.noPostsFound")}</p>
                <p className="text-sm opacity-70 mt-1">
                  {searchQuery ? t("dashboard.tryDifferentTerm") : t("dashboard.startPosting")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post: any) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="block bg-card rounded-2xl p-4 border border-border hover:border-accent hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <p className="text-sm text-foreground line-clamp-2 mb-3 font-medium">
                      {post.caption || t("dashboard.noCaption")}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-muted">
                          <Heart size={16} className="text-red-500" />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          <MessageCircle size={16} className="text-blue-500" />
                          {post.comments}
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          <Eye size={16} className="text-green-500" />
                          {post.views}
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          <Share2 size={16} className="text-purple-500" />
                          {post.shares}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Grid3X3, LogOut, BarChart3, MessageCircle, ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function UserProfile() {
  const { username } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequest, setFollowRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<string>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filter, setFilter] = useState<string>("available");

  useEffect(() => {
    if (!username) return;
    loadProfile();
  }, [username]);

  const loadProfile = async (sortValue?: string, filterValue?: string) => {
    const sortParam = sortValue || sort;
    const filterParam = filterValue || filter;
    const res = await fetch(`/api/users/${username}?sort=${sortParam}&filter=${filterParam}`);
    if (!res.ok) return;
    const data = await res.json();
    setProfile(data);
    setIsFollowing(data.isFollowing);

    if (session?.user?.id && data.id !== session.user.id) {
      const reqRes = await fetch(`/api/follow-requests?sent=true`);
      if (reqRes.ok) {
        const requests = await reqRes.json();
        const sent = requests.find((r: any) => r.followingId === data.id);
        setFollowRequest(sent || null);
      }
    }
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setShowSortMenu(false);
    loadProfile(value, filter);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    loadProfile(sort, value);
  };

  const handleFollow = async () => {
    if (!profile || loading) return;
    setLoading(true);

    if (profile.isPrivate && !isFollowing) {
      const res = await fetch("/api/follow-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      setLoading(false);
      if (res.ok) {
        const data = await res.json();
        setFollowRequest(data);
      }
      return;
    }

    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setIsFollowing(data.following);
      setProfile((prev: any) => ({
        ...prev,
        followersCount: data.following
          ? prev.followersCount + 1
          : prev.followersCount - 1,
      }));
    }
  };

  if (profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-zinc-400">{t("profile.notFound")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
      </div>
      );
  }

  const isMe = session?.user?.id === profile.id;

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/explore" className="text-foreground hover:text-accent transition">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="font-bold text-xl text-foreground tracking-wide truncate flex items-center gap-2">
            {profile.username}
            {profile.role === "OWNER" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500 text-black border border-yellow-600 shadow-sm">
                OWNER
              </span>
            )}
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5">
        <div className="flex items-center gap-5 mb-6">
          <Image
            src={profile.avatar || "/default-avatar.png"}
            alt={profile.username}
            width={90}
            height={90}
            unoptimized={profile.avatar?.includes("svg") || profile.avatar?.startsWith("/uploads/")}
            className="rounded-full object-cover bg-muted/20 border-2 border-border"
          />
          <div className="flex-1">
            <div className="flex justify-around text-center">
              <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">
                  {profile.posts?.length || 0}
                </p>
                <p className="text-sm text-muted font-medium">{t("profile.posts")}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">
                  {profile.followersCount || 0}
                </p>
                <p className="text-sm text-muted font-medium">{t("profile.followers")}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">
                  {profile.followingCount || 0}
                </p>
                <p className="text-sm text-muted font-medium">{t("profile.following")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-lg font-bold text-foreground mb-1">{profile.name}</p>
          {profile.bio && (
            <p className="text-base text-muted leading-relaxed">
              {profile.bio}
            </p>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base text-accent hover:opacity-80 mt-2 block"
            >
              {profile.website}
            </a>
          )}
        </div>

        {!isMe ? (
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleFollow}
              disabled={loading || followRequest}
              className={`flex-1 py-3 rounded-xl font-bold text-base transition disabled:opacity-50 ${
              isFollowing
                ? "bg-muted/20 text-foreground hover:bg-muted/30 border-2 border-border"
                : followRequest
                ? "bg-card text-muted border border-border cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90"
              }`}
            >
              {loading
                ? t("profile.loading")
                : isFollowing
                ? t("profile.followingBtn")
                : followRequest
                ? t("profile.requestSent")
                : t("profile.follow")}
            </button>
            <button
              onClick={async () => {
                const res = await fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: profile.id }),
                });
                if (res.ok) {
                  const data = await res.json();
                  router.push(`/messages/${data.id}`);
                }
              }}
              className="flex items-center justify-center px-4 py-3 rounded-xl font-bold text-base bg-card text-foreground hover:bg-muted/10 border border-border transition"
            >
              <MessageCircle size={20} className="mr-2" />
              {t("profile.message")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Link
              href="/users/dashboard"
              className="flex items-center justify-center py-3 rounded-xl font-bold text-base bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition"
            >
              <BarChart3 size={20} className="mr-2" />
              {t("profile.dashboard")}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="py-3 rounded-xl font-bold text-base transition bg-card text-foreground hover:bg-muted/10 border border-border flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              {t("profile.logout")}
            </button>
          </div>
        )}          {isMe && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => handleFilterChange("available")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition border ${
                filter === "available"
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-card text-foreground border-border hover:border-accent"
              }`}
            >
              {t("profile.available")}
            </button>
            <button
              onClick={() => handleFilterChange("unavailable")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition border ${
                filter === "unavailable"
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-card text-foreground border-border hover:border-accent"
              }`}
            >
              {t("profile.unavailable")}
            </button>
          </div>
        )}

        <div className="border-t border-border pt-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted font-semibold text-sm">
              <Grid3X3 size={18} />
              <span>{t("profile.labelPosts")}</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu((prev) => !prev)}
                className="flex items-center gap-1 text-sm text-foreground bg-card border border-border rounded-lg px-3 py-1.5 hover:border-accent transition"
              >
                {sort === "newest" && t("profile.sortNewest")}
                {sort === "oldest" && t("profile.sortOldest")}
                {sort === "most_viewed" && t("profile.sortMostViewed")}
                {sort === "least_viewed" && t("profile.sortLeastViewed")}
                <ChevronDown size={14} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  {[
                    { value: "newest", label: t("profile.sortNewest") },
                    { value: "oldest", label: t("profile.sortOldest") },
                    { value: "most_viewed", label: t("profile.sortMostViewed") },
                    { value: "least_viewed", label: t("profile.sortLeastViewed") },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full text-left px-4 py-2 text-sm transition hover:bg-muted/10 ${
                        sort === option.value ? "text-accent font-semibold" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {profile.posts?.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {profile.posts.map((post: any) => (
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
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted text-lg font-medium">{t("profile.noPostsYet")}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

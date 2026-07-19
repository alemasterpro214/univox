"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { Star, MessageCircle, Share2, ArrowLeft, Sparkles, Eye, Download, ChevronDown, Lock, Users, Globe, ImageIcon } from "lucide-react";
import GifPicker from "@/components/GifPicker";
import SaveButton from "@/components/SaveButton";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

export default function PostPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const { t, dateFnsLocale } = useTranslation();
  const [post, setPost] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [visibility, setVisibility] = useState<string>("public");
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/posts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setPost(null);
        } else {
          setPost(data);
        setLiked(data.likedByMe);
        setSaved(data.savedByMe);
        setLikesCount(data.likesCount);
        setViewsCount(data.viewsCount);
        setSharesCount(data.sharesCount);
        setVisibility(data.visibility || "public");
        }
        setLoading(false);
      })
      .catch(() => {
        setPost(null);
        setLoading(false);
      });
    loadComments();
  }, [id]);

  const loadComments = async () => {
    const res = await fetch(`/api/posts/${id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
  };

  const handleLike = async () => {
    const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikesCount((prev) => (data.liked ? prev + 1 : prev - 1));
    }
  };

  const handleVisibilityChange = async (newVisibility: string) => {
    if (newVisibility === visibility) {
      setShowVisibilityMenu(false);
      return;
    }
    const res = await fetch(`/api/posts/${id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: newVisibility }),
    });
    if (res.ok) {
      setVisibility(newVisibility);
    }
    setShowVisibilityMenu(false);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
    const res = await fetch(`/api/posts/${id}/share`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setSharesCount(data.sharesCount);
    }
  };



  const handleDownload = async () => {
    const media = post.media?.[0];
    if (!media || post.isUnavailable) return;
    try {
      const res = await fetch(media.url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unyvox-post-${post.id}.${media.type === "video" ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const sendGifComment = async (gifUrl: string) => {
    const res = await fetch(`/api/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "",
        gifUrl,
        parentId: replyingTo?.id,
      }),
    });
    if (res.ok) {
      setShowGifPicker(false);
      setReplyingTo(null);
      loadComments();
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const res = await fetch(`/api/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newComment, parentId: replyingTo?.id }),
    });
    if (res.ok) {
      setNewComment("");
      setReplyingTo(null);
      loadComments();
    }
  };

  if (loading || post === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-zinc-500">{t("post.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/explore" className="text-foreground hover:text-accent transition">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="font-semibold text-lg">{t("post.title")}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        <div className="flex items-center gap-3 p-4">
          <Link href={`/users/${post.user.username}`}>
            <Image
              src={post.user.avatar || "/default-avatar.png"}
              alt={post.user.username}
              width={40}
              height={40}
              unoptimized={post.user.avatar?.includes("svg") || post.user.avatar?.startsWith("/uploads/")}
              className="rounded-full object-cover bg-muted/20"
            />
          </Link>
          <div className="flex-1">
          <Link
            href={`/users/${post.user.username}`}
            className="font-bold text-sm text-foreground hover:text-accent block truncate"
          >
            {post.user.username}
          </Link>
          {post.user.name && (
            <p className="text-xs text-muted truncate">{post.user.name}</p>
          )}
          </div>
          {session?.user?.id === post.user?.id && (
            <div className="relative">
              <button
                onClick={() => setShowVisibilityMenu((prev) => !prev)}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground bg-card border border-border rounded-lg px-2 py-1 transition"
              >
                {visibility === "public" && <Globe size={14} />}
                {visibility === "private" && <Lock size={14} />}
                {visibility === "close_friends" && <Users size={14} />}
                <span className="capitalize">
                  {visibility === "close_friends" ? "Close Friends" : visibility}
                </span>
                <ChevronDown size={14} />
              </button>
              {showVisibilityMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  {[
                    { value: "public", label: "Pubblico", icon: Globe },
                    { value: "private", label: "Privato", icon: Lock },
                    { value: "close_friends", label: "Close Friends", icon: Users },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleVisibilityChange(option.value)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition hover:bg-muted/10 ${
                        visibility === option.value ? "text-accent font-semibold" : "text-foreground"
                      }`}
                    >
                      <option.icon size={16} />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative aspect-square bg-muted/20">
          {post.isUnavailable ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
              <span className="text-lg font-bold text-zinc-400">{t("post.unavailable")}</span>
              <span className="text-xs text-zinc-600 mt-1">{t("post.contentExpired")}</span>
            </div>
          ) : post.media?.[0] ? (
            post.media[0].type === "video" ? (
              <video
                src={post.media[0].url}
                controls
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <Image
                src={post.media[0].url}
                alt="Post"
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                priority
                unoptimized={post.media[0]?.url?.startsWith('/uploads/')}
                className="object-cover"
              />
            )
          ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            {t("post.textPost")}
          </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={handleLike}
              disabled={session?.user?.id === post.user?.id}
              title={session?.user?.id === post.user?.id ? t("post.cantLikeOwn") : undefined}
              className={`flex flex-col items-center gap-0.5 transition ${
                session?.user?.id === post.user?.id ? "opacity-50 cursor-not-allowed" : "active:scale-125"
              }`}
            >
              <Star
                size={24}
                className={liked ? "fill-blue-500 text-blue-500" : "text-zinc-400"}
              />
              <span className="text-[10px] text-zinc-500">{likesCount}</span>
            </button>
            <button onClick={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" })} className="flex flex-col items-center gap-0.5">
              <MessageCircle size={24} className="text-zinc-400" />
              <span className="text-[10px] text-zinc-500">{comments.length}</span>
            </button>
            <button onClick={handleShare} className="flex flex-col items-center gap-0.5 transition active:scale-125">
              <Share2 size={24} className="text-zinc-400" />
              <span className="text-[10px] text-zinc-500">{sharesCount}</span>
            </button>
            <button onClick={handleDownload} disabled={post.isUnavailable || !post.media?.[0]} className="flex flex-col items-center gap-0.5 transition active:scale-125 disabled:opacity-30">
              <Download size={24} className="text-zinc-400" />
            </button>
            <SaveButton postId={id as string} initialSaved={saved} />
          </div>

          <div className="flex items-center gap-4 mb-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Eye size={14} className="text-blue-400" />
              {viewsCount} {t("post.views")}
            </span>
            <span>{likesCount} {t("post.likes")}</span>
          </div>

          <div className="mb-2">
            <span className="font-bold text-sm mr-2 text-foreground">{post.user.username}</span>
            <span className="text-sm text-muted">{post.caption}</span>
          </div>

          {post.isAiGenerated && (
            <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
              <Sparkles size={12} />
              <span>{t("post.aiGenerated")}</span>
            </div>
          )}
          {post.isUnavailable && (
            <div className="text-xs text-zinc-500 mb-2">
              {t("post.expiredOn")} {post.expiresAt ? new Date(post.expiresAt).toLocaleDateString() : t("post.unknownDate")}
            </div>
          )}

          <p className="text-xs text-muted mb-4">
            {formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
              locale: dateFnsLocale,
            })}
          </p>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3">Commenti</h3>
            <div className="space-y-4 mb-4">
              {comments.length === 0 ? (
                <p className="text-muted text-sm">Nessun commento. Sii il primo!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <Link href={`/users/${comment.user.username}`}>
                        <Image
                          src={comment.user.avatar || "/default-avatar.png"}
                          alt={comment.user.username}
                          width={28}
                          height={28}
                          unoptimized={comment.user.avatar?.includes("svg") || comment.user.avatar?.startsWith("/uploads/")}
                          className="rounded-full object-cover bg-muted/20"
                        />
                      </Link>
                      <div className="flex-1">
                        <Link
                          href={`/users/${comment.user.username}`}
                          className="font-semibold mr-2 hover:text-accent"
                        >
                          {comment.user.username}
                        </Link>
                        {comment.gifUrl ? (
                          <img
                            src={comment.gifUrl}
                            alt="GIF"
                            className="mt-1 rounded-lg max-w-[200px] h-auto"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-zinc-300">{comment.text}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setReplyingTo(comment)}
                          className="block text-xs text-muted hover:text-accent mt-1"
                        >
                          Rispondi
                        </button>
                        {comment.replies?.length > 0 && (
                          <div className="mt-2 pl-3 border-l-2 border-border space-y-2">
                            {comment.replies.map((reply: any) => (
                              <div key={reply.id} className="text-sm">
                                <Link
                                  href={`/users/${reply.user.username}`}
                                  className="font-semibold mr-2 hover:text-accent"
                                >
                                  {reply.user.username}
                                </Link>
                                {reply.gifUrl ? (
                                  <img
                                    src={reply.gifUrl}
                                    alt="GIF"
                                    className="mt-1 rounded-lg max-w-[160px] h-auto"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-zinc-300">{reply.text}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="flex gap-2 relative">
              {replyingTo && (
                <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-3 py-1 bg-accent/10 text-accent text-xs rounded-t-lg">
                  <span>Rispondi a {replyingTo.user.username}</span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              )}
              {showGifPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-50">
                  <GifPicker
                    onSelect={sendGifComment}
                    onClose={() => setShowGifPicker(false)}
                  />
                </div>
              )}
              <div className="flex gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setShowGifPicker((prev) => !prev)}
                  className="p-2 bg-card text-foreground hover:bg-muted/20 border border-border rounded-lg transition"
                  title="GIF"
                >
                  <ImageIcon size={18} />
                </button>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyingTo ? `Rispondi a ${replyingTo.user.username}...` : "Aggiungi un commento..."}
                  className="flex-1 bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-muted border border-border"
                />
                <button
                  type="submit"
                  className="text-accent font-semibold text-sm"
                >
                  Pubblica
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

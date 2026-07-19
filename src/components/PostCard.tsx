"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, MessageCircle, Share2, Sparkles, Eye, Download } from "lucide-react";
import OwnerBadge from "./OwnerBadge";
import SaveButton from "./SaveButton";
import { useSocket } from "./SocketProvider";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

interface PostCardProps {
  post: any;
  onLike?: (postId: string, liked: boolean) => void;
  priority?: boolean;
}

export default function PostCard({ post, onLike, priority }: PostCardProps) {
  const { data: session } = useSession();
  const { t, dateFnsLocale } = useTranslation();
  const isOwnPost = session?.user?.id === post.user?.id;
  const [liked, setLiked] = useState(post.likedByMe || false);
  const [saved, setSaved] = useState(post.savedByMe || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);
  const [viewsCount, setViewsCount] = useState(post.viewsCount || 0);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [isLiking, setIsLiking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const { socket } = useSocket();

  const handleLike = useCallback(async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikesCount(data.likesCount ?? likesCount);
        if (onLike) onLike(post.id, data.liked);
      }
    } finally {
      setIsLiking(false);
    }
  }, [isLiking, likesCount, post.id, onLike]);

  const loadComments = useCallback(async () => {
    if (commentsLoaded) return;
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        setCommentsLoaded(true);
      }
    } catch {}
  }, [post.id, commentsLoaded]);

  // Lazy-load comments only when user clicks to view them
  const toggleComments = useCallback(() => {
    if (!showComments && !commentsLoaded) {
      loadComments();
    }
    setShowComments((prev) => !prev);
  }, [showComments, commentsLoaded, loadComments]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const room = `post:${post.id}`;
    socket.emit("join_room", room);

    const handleLikeEvent = (data: any) => {
      if (data?.postId !== post.id) return;
      setLikesCount(data.likesCount);
    };

    const handleCommentEvent = (data: any) => {
      if (data?.postId !== post.id) return;
      setComments((prev) =>
        prev.some((c) => c.id === data.comment.id) ? prev : [...prev, data.comment]
      );
    };

    socket.on("post_liked", handleLikeEvent);
    socket.on("post_commented", handleCommentEvent);

    return () => {
      socket.emit("leave_room", room);
      socket.off("post_liked", handleLikeEvent);
      socket.off("post_commented", handleCommentEvent);
    };
  }, [socket, post.id]);

  // Track view with IntersectionObserver — no socket room join per post
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !viewedRef.current) {
            viewedRef.current = true;
            fetch(`/api/posts/${post.id}/view`, { method: "POST" })
              .then((res) => {
                if (res.ok) res.json().then((data) => setViewsCount(data.viewsCount));
              })
              .catch(() => {});
          }
        });
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.id]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment, parentId: replyingTo?.id }),
      });
      if (res.ok) {
        const savedComment = await res.json();
        setNewComment("");
        setReplyingTo(null);
        setComments((prev) => {
          if (prev.some((c) => c.id === savedComment.id)) return prev;
          if (savedComment.parentId) {
            return prev.map((c) =>
              c.id === savedComment.parentId
                ? { ...c, replies: [...(c.replies || []), savedComment] }
                : c
            );
          }
          return [...prev, savedComment];
        });
      }
    } catch {}
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    try {
      const res = await fetch(`/api/posts/${post.id}/share`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSharesCount(data.sharesCount);
      }
    } catch {}
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
    } catch {}
  };

  return (
    <div ref={cardRef} className="bg-card border-b border-border pb-4">
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
        <div className="flex-1 min-w-0">
          <Link
            href={`/users/${post.user.username}`}
            className="font-bold text-sm text-foreground hover:text-accent block truncate"
          >
            {post.user.username} {post.user.role === "OWNER" && <OwnerBadge />}
          </Link>
          {post.user.name && (
            <p className="text-xs text-muted truncate">{post.user.name}</p>
          )}
        </div>
      </div>

      <div className="relative aspect-square bg-muted/20">
        {post.isUnavailable ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
            <span className="text-lg font-bold text-zinc-400">{t("postCard.unavailable")}</span>
            <span className="text-xs text-zinc-600 mt-1">{t("postCard.contentExpired")}</span>
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
              priority={priority}
              unoptimized={post.media[0]?.url?.startsWith('/uploads/')}
              className="object-cover"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            {t("postCard.textPost")}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={handleLike}
            disabled={isOwnPost}
            title={isOwnPost ? t("postCard.cantLikeOwn") : undefined}
            className={`flex flex-col items-center gap-0.5 transition ${
              isOwnPost ? "opacity-50 cursor-not-allowed" : "active:scale-125"
            }`}
          >
            <Star
              size={24}
              className={liked ? "fill-blue-500 text-blue-500" : "text-zinc-400"}
            />
            <span className="text-[10px] text-zinc-500">{likesCount}</span>
          </button>
          <button onClick={toggleComments} className="flex flex-col items-center gap-0.5">
            <MessageCircle size={24} className="text-zinc-400" />
            <span className="text-[10px] text-zinc-500">
              {post.commentsCount ?? 0}
            </span>
          </button>
          <button onClick={handleShare} className="flex flex-col items-center gap-0.5 transition active:scale-125">
            <Share2 size={24} className="text-zinc-400" />
            <span className="text-[10px] text-zinc-500">{sharesCount}</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={post.isUnavailable || !post.media?.[0]}
            className="flex flex-col items-center gap-0.5 transition active:scale-125 disabled:opacity-30"
          >
            <Download size={24} className="text-zinc-400" />
          </button>
          <SaveButton postId={post.id} initialSaved={saved} />
        </div>

        <div className="flex items-center gap-4 mb-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Eye size={14} className="text-blue-400" />
            {viewsCount} {t("postCard.views")}
          </span>
          <span>{likesCount} {t("postCard.likes")}</span>
        </div>

        <div className="mb-2">
          <span className="font-bold text-sm mr-2 text-foreground">{post.user.username}</span>
          <span className="text-sm text-muted">{post.caption}</span>
        </div>

        {post.isAiGenerated && (
          <div className="flex items-center gap-1 text-xs text-blue-400 mb-2">
            <Sparkles size={12} />
            <span>{t("postCard.aiGenerated")}</span>
          </div>
        )}
        {post.isUnavailable && (
          <div className="text-xs text-zinc-500 mb-2">
            {t("postCard.expiredOn")} {post.expiresAt ? new Date(post.expiresAt).toLocaleDateString() : t("postCard.unknownDate")}
          </div>
        )}

        <p className="text-xs text-muted mb-3">
          {formatDistanceToNow(new Date(post.createdAt), {
            addSuffix: true,
            locale: dateFnsLocale,
          })}
        </p>

        {/* Comments section — lazy loaded */}
        {showComments && (
          <div className="space-y-3">
            {comments.slice(0, 3).map((comment: any) => (
              <div key={comment.id} className="text-sm">
                <div className="flex items-start gap-2">
                  <Link href={`/users/${comment.user.username}`}>
                    <Image
                      src={comment.user.avatar || "/default-avatar.png"}
                      alt={comment.user.username}
                      width={24}
                      height={24}
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
                    <span className="text-zinc-300">{comment.text}</span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(comment)}
                      className="block text-xs text-muted hover:text-accent mt-1"
                    >
                      {t("postCard.reply")}
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
                            <span className="text-zinc-300">{reply.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {comments.length > 3 && (
              <Link
                href={`/posts/${post.id}`}
                className="text-sm text-muted hover:text-foreground"
              >
                {t("postCard.seeAllComments")} {comments.length} {t("postCard.commentsCount_other", { count: comments.length })}
              </Link>
            )}
            {comments.length === 0 && commentsLoaded && (
              <p className="text-xs text-muted">{t("postCard.noComments")}</p>
            )}
          </div>
        )}

        <form onSubmit={submitComment} className="flex gap-2 mt-3">
          {replyingTo && (
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-3 py-1 bg-accent/10 text-accent text-xs rounded-t-lg">
              <span>{t("postCard.reply")} {replyingTo.user.username}</span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyingTo ? `${t("postCard.reply")} ${replyingTo.user.username}...` : t("postCard.commentPlaceholder")}
            className="flex-1 bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-muted border border-border"
          />
          <button type="submit" className="text-accent font-semibold text-sm">
            {t("postCard.publish")}
          </button>
        </form>
      </div>
    </div>
  );
}

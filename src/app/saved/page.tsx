"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { ArrowLeft, Plus, Lock, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function Saved() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      loadPlaylists();
    }
  }, [status, router]);

  const loadPlaylists = async () => {
    const res = await fetch("/api/playlists");
    if (res.ok) {
      const data = await res.json();
      setPlaylists(data);
      if (data.length > 0 && !activePlaylist) {
        setActivePlaylist(data[0]);
        loadPlaylistPosts(data[0].id);
      } else {
        setLoading(false);
      }
    }
  };

  const loadPlaylistPosts = async (playlistId: string) => {
    setLoading(true);
    const res = await fetch(`/api/playlists/${playlistId}`);
    if (res.ok) {
      const data = await res.json();
      setActivePlaylist(data);
      setPosts(data.posts || []);
    }
    setLoading(false);
  };

  const createPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlaylistName.trim(), isPrivate: true }),
    });
    if (res.ok) {
      setNewPlaylistName("");
      setShowCreate(false);
      loadPlaylists();
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm(t("saved.deleteConfirm"))) return;
    const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadPlaylists();
      if (activePlaylist?.id === id) {
        setActivePlaylist(null);
        setPosts([]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="text-foreground hover:text-accent transition">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="font-semibold text-lg">{t("saved.title")}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider">{t("saved.yourPlaylists")}</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 rounded-full bg-accent text-accent-foreground hover:opacity-90 transition"
          >
            <Plus size={18} />
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createPlaylist} className="bg-card rounded-xl p-4 border border-border mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t("saved.playlistName")}
                className="flex-1 bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-muted border border-border"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold"
              >
                {t("saved.create")}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-2 text-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-3 overflow-x-auto pb-4 mb-2">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              role="button"
              tabIndex={0}
              onClick={() => loadPlaylistPosts(playlist.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  loadPlaylistPosts(playlist.id);
                }
              }}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border transition cursor-pointer ${
                activePlaylist?.id === playlist.id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <Lock size={14} className="text-muted" />
              <span className="text-sm font-medium text-foreground">{playlist.name}</span>
              <span className="text-xs text-muted">({playlist._count.posts})</span>
              {playlist.name !== "Post Salvati" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(playlist.id);
                  }}
                  className="ml-1 text-muted hover:text-red-500 transition"
                  aria-label={t("saved.deleteAria")}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p>{t("saved.emptyPlaylist")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
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
                        className="object-cover"
                      />
                    ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

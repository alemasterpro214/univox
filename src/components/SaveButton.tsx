"use client";

import { useEffect, useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Playlist {
  id: string;
  name: string;
}

interface SaveButtonProps {
  postId: string;
  initialSaved?: boolean;
}

export default function SaveButton({ postId, initialSaved = false }: SaveButtonProps) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(initialSaved);
  const [showModal, setShowModal] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  useEffect(() => {
    if (showModal) {
      loadPlaylists();
    }
  }, [showModal]);

  const loadPlaylists = async () => {
    setLoading(true);
    const [allRes, savedRes] = await Promise.all([
      fetch("/api/playlists"),
      fetch(`/api/posts/${postId}/saved-playlists`),
    ]);

    if (allRes.ok) {
      const allData = await allRes.json();
      setPlaylists(Array.isArray(allData) ? allData : []);
    }

    if (savedRes.ok) {
      const savedData = await savedRes.json();
      setSavedPlaylists(savedData.map((p: Playlist) => p.id));
      setSaved(savedData.length > 0);
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
      const playlist = await res.json();
      setPlaylists((prev) => [...prev, playlist]);
      setNewPlaylistName("");
      await handleSaveToPlaylist(playlist.id);
    }
  };

  const handleToggle = async () => {
    if (processing) return;
    setProcessing(true);

    if (saved) {
      try {
        const res = await fetch(`/api/posts/${postId}/unsave`, { method: "POST" });
        if (res.ok) {
          setSaved(false);
          setSavedPlaylists([]);
        }
      } catch (err) {
        console.error("Unsave error:", err);
      }
    } else {
      setShowModal(true);
    }

    setProcessing(false);
  };

  const handleSaveToPlaylist = async (playlistId: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const res = await fetch(`/api/posts/${postId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
        setSavedPlaylists((prev) => (data.saved ? [...prev, data.playlistId] : prev.filter((id) => id !== data.playlistId)));
        if (data.saved) {
          setShowModal(false);
        }
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={loading || processing}
        className="ml-auto transition active:scale-125 disabled:opacity-50"
      >
        <Bookmark
          size={24}
          className={saved ? "fill-accent text-accent" : "text-zinc-400"}
        />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{t("saveButton.saveTo")}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createPlaylist} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t("saveButton.playlistName")}
                className="flex-1 bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-muted border border-border"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="px-3 py-2 rounded-lg bg-accent text-accent-foreground disabled:opacity-50"
              >
                <Plus size={18} />
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
                </div>
              ) : playlists.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  {t("saveButton.createNew")}
                </p>
              ) : (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handleSaveToPlaylist(playlist.id)}
                    disabled={savedPlaylists.includes(playlist.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                      savedPlaylists.includes(playlist.id)
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {playlist.name}
                    </span>
                    {savedPlaylists.includes(playlist.id) ? (
                      <span className="text-xs text-accent">{t("saveButton.savedIn")}</span>
                    ) : (
                      <Plus size={16} className="text-muted" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

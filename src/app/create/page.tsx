"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useTranslation } from "@/lib/i18n";
import { ImageIcon, X, Sparkles, Clock, Eye, Lock, Users, Globe, AlertTriangle } from "lucide-react";
import Image from "next/image";

function d(t: (k: string) => string): { label: string; hours: number }[] {
  return [
    { label: t("create.durationOptions.1h"), hours: 1 },
    { label: t("create.durationOptions.6h"), hours: 6 },
    { label: t("create.durationOptions.12h"), hours: 12 },
    { label: t("create.durationOptions.1d"), hours: 24 },
    { label: t("create.durationOptions.3d"), hours: 72 },
    { label: t("create.durationOptions.1w"), hours: 168 },
    { label: t("create.durationOptions.2w"), hours: 336 },
    { label: t("create.durationOptions.3w"), hours: 504 },
  ];
}

function getVisibilityOptions(t: (k: string) => string) {
  return [
    { value: "public", label: t("create.public"), description: t("create.publicDesc"), icon: Globe },
    { value: "close_friends", label: t("create.closeFriends"), description: t("create.closeFriendsDesc"), icon: Users },
    { value: "private", label: t("create.private"), description: t("create.privateDesc"), icon: Lock },
  ];
}

const KEYWORD_SUGGESTIONS: Record<string, string[]> = {
  mare: ["spiaggia", "estate", "vacanze", "onde", "relax"],
  montagna: ["escursione", "natura", "trekking", "panorama", "neve"],
  città: ["urban", "street", "architettura", "viaggio", "metropoli"],
  cibo: ["food", "ristorante", "ricetta", "gourmet", "delicious"],
  musica: ["concerto", "canzone", "artist", "playlist", "live"],
  sport: ["fitness", "allenamento", "partita", "goal", "vittoria"],
  arte: ["design", "creatività", "pittura", "illustrazione", "inspiration"],
  tech: ["tecnologia", "innovazione", "gadget", "coding", "futuro"],
  moda: ["outfit", "style", "trend", "fashion", "look"],
  animali: ["pets", "natura", "wildlife", "cute", "amore"],
};

const MAX_FILE_SIZE_MB = 150;
const MAX_VIDEO_WIDTH = 3840;
const MAX_VIDEO_HEIGHT = 2160;

export default function Create() {
  const { t } = useTranslation();
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"image" | "video">("image");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [durationHours, setDurationHours] = useState<number>(504);
  const [visibility, setVisibility] = useState<string>("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoWarning, setVideoWarning] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkVideoResolution = (file: File): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (video.videoWidth > MAX_VIDEO_WIDTH || video.videoHeight > MAX_VIDEO_HEIGHT) {
          setVideoWarning(`Risoluzione troppo avanzata (${video.videoWidth}x${video.videoHeight}). Il massimo supportato è 4K (${MAX_VIDEO_WIDTH}x${MAX_VIDEO_HEIGHT}).`);
        } else {
          setVideoWarning(null);
        }
        resolve();
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      video.src = url;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoWarning(null);
    setSelectedFile(file);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`${t("create.fileTooBig")} ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const type = file.type.startsWith("video") ? "video" : "image";
    setFileType(type);
    setError(null);

    if (type === "video") {
      await checkVideoResolution(file);
    }

    // Usa createObjectURL per preview veloce senza caricare tutto in memoria
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  const addKeyword = (raw: string) => {
    const value = raw.trim().toLowerCase().replace(/[^a-z0-9àèéìòù#_\-]/g, "");
    if (!value) return;
    if (keywords.includes(value)) return;
    if (keywords.length >= 20) return;
    setKeywords((prev) => [...prev, value]);
    setKeywordInput("");
  };

  const removeKeyword = (value: string) => {
    setKeywords((prev) => prev.filter((k) => k !== value));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  const handleKeywordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    text
      .split(/[,\n\s]+/)
      .map((k) => k.trim())
      .filter(Boolean)
      .forEach((k) => addKeyword(k));
  };

  const handleKeywordBlur = () => {
    if (keywordInput.trim()) {
      addKeyword(keywordInput);
    }
  };

  const suggestedKeywords = useMemo(() => {
    const captionLower = caption.toLowerCase();
    const result = new Set<string>();
    for (const [key, words] of Object.entries(KEYWORD_SUGGESTIONS)) {
      if (captionLower.includes(key)) {
        for (const word of words) {
          if (!keywords.includes(word)) result.add(word);
        }
      }
    }
    return Array.from(result).slice(0, 10);
  }, [caption, keywords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!caption.trim() && !preview) {
      setError(t("create.noContentError"));
      return;
    }
    if (keywords.length < 1) {
      setError(t("create.keywordError"));
      return;
    }

    setLoading(true);

    try {
      let media: { url: string; type: "image" | "video" }[] = [];

      if (preview && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || t("create.uploadError"));
        }

        const uploadData = await uploadRes.json();
        media = [{ url: uploadData.url, type: fileType }];
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          media,
          isAiGenerated,
          visibility,
          keywords,
          expiresAt: expiresAt.toISOString(),
        }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const err = await res.json();
        setError(err.error || t("create.createError"));
      }
    } catch (error: any) {
      setError(error.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const DURATION_OPTIONS = d(t);
  const selectedDuration = DURATION_OPTIONS.find((o) => o.hours === durationHours) || DURATION_OPTIONS[DURATION_OPTIONS.length - 1];

  return (
    <div className="min-h-screen bg-background pb-20 lg:pr-16">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-lg text-foreground">{t("create.title")}</h1>
          <button
            onClick={handleSubmit}
            disabled={loading || (!caption.trim() && !preview)}
            className="text-accent font-semibold disabled:opacity-50"
          >
            {loading ? t("create.publishing") : t("create.share")}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-2xl p-4 text-center">
            {preview ? (
              <div className="relative w-full aspect-square">
                {fileType === "video" ? (
                  <video
                    src={preview}
                    controls
                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover rounded-xl"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
                    setPreview(null);
                    setSelectedFile(null);
                    setVideoWarning(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 bg-background/70 rounded-full p-1"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block py-8">
                <ImageIcon size={48} className="mx-auto text-muted mb-4" />
                <p className="text-muted">{t("create.uploadPhoto")}</p>
                <p className="text-muted/70 text-xs mt-1">{t("create.uploadFormats")} {MAX_FILE_SIZE_MB}MB</p>
                <p className="text-muted/70 text-xs mt-1">{t("create.maxQuality")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {videoWarning && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{videoWarning}</span>
            </div>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("create.captionPlaceholder")}
            className="w-full bg-card text-foreground rounded-xl p-4 h-32 resize-none focus:outline-none placeholder:text-muted border border-border"
          />

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-accent" />
              <span className="text-sm font-medium">{t("create.visibilityDuration")}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {            d(t).map((option) => (
                <button
                  key={option.hours}
                  type="button"
                  onClick={() => setDurationHours(option.hours)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition ${
                    durationHours === option.hours
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted/20 text-muted hover:bg-muted/30"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              {t("create.visibilityDurationDesc")} {selectedDuration.label.toLowerCase()}. {t("create.expiresAfter")}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={18} className="text-accent" />
              <span className="text-sm font-medium">{t("create.visibility")}</span>
            </div>
            <div className="space-y-2">
              {getVisibilityOptions(t).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    visibility === option.value
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <option.icon size={20} className="text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{option.label}</p>
                    <p className="text-xs text-muted">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-accent" />
                <span className="text-sm font-medium">{t("create.aiGenerated")}</span>
              </div>
              <button
                type="button"
                aria-pressed={isAiGenerated}
                aria-label={t("create.aiLabel")}
                onClick={() => setIsAiGenerated((prev) => !prev)}
                className={`w-12 h-6 rounded-full transition relative ${
                  isAiGenerated ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isAiGenerated ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <label className="block text-sm font-medium mb-2 text-foreground">
              Keywords ({keywords.length}/20) <span className="text-accent">*</span>
            </label>
            <p className="text-xs text-muted mb-2">
              {t("create.keywordsHint")}
            </p>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onPaste={handleKeywordPaste}
              onBlur={handleKeywordBlur}
              placeholder={t("create.keywordsPlaceholder")}
              className="w-full bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-muted border border-border"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 bg-accent/20 text-accent text-xs px-2 py-1 rounded-full"
                >
                  {k}
                  <button
                    type="button"
                    aria-label={t("create.removeKeyword")}
                    onClick={() => removeKeyword(k)}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {suggestedKeywords.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted mb-1">{t("create.suggested")}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => addKeyword(word)}
                      className="text-xs bg-muted/20 text-foreground hover:bg-accent/20 hover:text-accent px-2 py-1 rounded-full transition"
                    >
                      + {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {keywords.length < 1 && (
              <p className="text-xs text-accent mt-2">
                {t("create.keywordRequired")}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-accent bg-accent/10 rounded-lg p-3">{error}</p>
          )}
        </form>
      </main>

      <BottomNav />
    </div>
  );
}

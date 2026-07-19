"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/components/ThemeProvider";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Camera,
  Loader2,
  Palette,
  Circle,
  Bug,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type UserStatus = "ONLINE" | "DND" | "OFFLINE";
type ThemeColor = "pink" | "blue" | "green" | "purple" | "orange" | "red";

const themeColors: { value: ThemeColor; label: string; color: string }[] = [
  { value: "pink", label: "pink", color: "bg-pink-500" },
  { value: "blue", label: "blue", color: "bg-sky-500" },
  { value: "green", label: "green", color: "bg-green-500" },
  { value: "purple", label: "purple", color: "bg-purple-500" },
  { value: "orange", label: "orange", color: "bg-orange-500" },
  { value: "red", label: "red", color: "bg-red-500" },
];

const userStatuses: { value: UserStatus; label: string; description: string; color: string }[] = [
  { value: "ONLINE", label: "online", description: "onlineDesc", color: "bg-green-500" },
  { value: "DND", label: "dnd", description: "dndDesc", color: "bg-red-500" },
  { value: "OFFLINE", label: "offline", description: "offlineDesc", color: "bg-zinc-500" },
];

export default function Settings() {
  const { t } = useTranslation();
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { theme, setTheme, themeColor, setThemeColor } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState(session?.user?.image || "");
  const [userStatus, setUserStatus] = useState<UserStatus>("ONLINE");
  const [debugMode, setDebugMode] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    setAvatar(session?.user?.image || "");
  }, [session?.user?.image]);

  useEffect(() => {
    const savedDebug = localStorage.getItem("unyvox-debug-mode");
    if (savedDebug) {
      setDebugMode(savedDebug === "true");
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetch("/api/users/me/status")
        .then((res) => res.json())
        .then((data) => {
          if (data?.status) {
            setUserStatus(data.status as UserStatus);
          }
        })
        .catch(console.error);
    }
  }, [status, session?.user?.id]);

  const handleStatusChange = async (newStatus: UserStatus) => {
    setSavingStatus(true);
    try {
      const res = await fetch("/api/users/me/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setUserStatus(newStatus);
      } else {
        alert("Errore nel salvare lo stato");
      }
    } catch (error) {
      console.error("Status update error:", error);
      alert("Errore nel salvare lo stato");
    } finally {
      setSavingStatus(false);
    }
  };

  const toggleDebugMode = () => {
    const next = !debugMode;
    setDebugMode(next);
    localStorage.setItem("unyvox-debug-mode", String(next));
  };

  /** Ridimensiona l'immagine a max 400px lato + comprimi in WebP/JPEG */
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // GIF animati: salta la compressione per non perdere l'animazione
      if (file.type === "image/gif") {
        resolve(file);
        return;
      }

      const img = document.createElement("img");
      const blobUrl = URL.createObjectURL(file);

      img.onload = () => {
        // Revoca subito il blob URL dopo il caricamento
        URL.revokeObjectURL(blobUrl);

        const MAX = 400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Prova WebP, se non supportato → JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Compressione fallita"));
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Immagine non valida"));
      };
      img.src = blobUrl;
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("Formato non supportato. Usa JPG, PNG, WEBP o GIF.");
      e.target.value = "";
      return;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File troppo grande. Dimensione massima: ${MAX_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }

    const previousAvatar = avatar;
    setUploading(true);

    try {
      // 1) Mostra subito il preview locale (zero upload)
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl);

      // 2) Comprimi l'immagine lato client (max 400px + WebP)
      const compressedBlob = await compressImage(file);

      // 3) Upload via FormData (no overhead base64)
      const formData = new FormData();
      formData.append("file", compressedBlob, "avatar.webp");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Errore nel caricamento dell'immagine");
      }

      const { url } = await uploadRes.json();

      // 4) Revoca il preview locale e usa l'URL definitivo
      URL.revokeObjectURL(localUrl);
      setAvatar(url);

      // 5) Salva l'avatar nel profilo
      const updateRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      });

      if (!updateRes.ok) {
        throw new Error("Errore nell'aggiornamento del profilo");
      }

      await update({ image: url });
    } catch (error) {
      console.error("Avatar upload error:", error);
      setAvatar(previousAvatar);
      alert("Impossibile aggiornare la foto profilo. Riprova.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
          <h1 className="font-semibold text-lg">{t("settings.title")}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">
            {t("settings.profile")}
          </h2>

          <div className="flex flex-col items-center">
            <div className="relative group">
              <Image
                src={avatar || "/default-avatar.png"}
                alt="Avatar"
                width={96}
                height={96}
                unoptimized={avatar?.includes("svg") || avatar?.startsWith("/uploads/")}
                className="w-24 h-24 rounded-full object-cover border-2 border-border bg-muted/20"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition disabled:opacity-100"
                aria-label={t("settings.changePhoto")}
              >
                {uploading ? (
                  <Loader2 size={24} className="text-white animate-spin" />
                ) : (
                  <Camera size={24} className="text-white" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-sm text-muted mt-3">
              {uploading ? t("settings.uploading") : t("settings.tapToChange")}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mt-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">
            {t("settings.appearance")}
          </h2>

          <div className="space-y-3">
            <button
              onClick={() => setTheme("light")}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition ${
                theme === "light"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <Sun size={24} className="text-accent" />
              <div className="text-left">
                <p className="font-semibold text-foreground">{t("settings.light")}</p>
                <p className="text-xs text-muted">{t("settings.lightDesc")}</p>
              </div>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition ${
                theme === "dark"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <Moon size={24} className="text-accent" />
              <div className="text-left">
                <p className="font-semibold text-foreground">{t("settings.dark")}</p>
                <p className="text-xs text-muted">{t("settings.darkDesc")}</p>
              </div>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition ${
                theme === "system"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <Monitor size={24} className="text-accent" />
              <div className="text-left">
                <p className="font-semibold text-foreground">{t("settings.system")}</p>
                <p className="text-xs text-muted">{t("settings.systemDesc")}</p>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mt-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Palette size={18} className="text-accent" />
            {t("settings.themeColor")}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {themeColors.map((color) => (
              <button
                key={color.value}
                onClick={() => setThemeColor(color.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
                  themeColor === color.value
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                }`}
              >
                <span className={`w-8 h-8 rounded-full ${color.color}`} />
                <span className="text-xs font-medium text-foreground">{t("settings.colors." + color.label)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mt-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Circle size={18} className="text-accent" />
            {t("settings.userStatus")}
          </h2>
          <div className="space-y-3">
            {userStatuses.map((statusOption) => (
              <button
                key={statusOption.value}
                onClick={() => handleStatusChange(statusOption.value)}
                disabled={savingStatus}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition text-left ${
                  userStatus === statusOption.value
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                }`}
              >
                <span className={`w-4 h-4 rounded-full ${statusOption.color}`} />
                <div>
                  <p className="font-semibold text-foreground">{t("settings." + statusOption.label)}</p>
                  <p className="text-xs text-muted">{t("settings." + statusOption.description)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mt-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Bug size={18} className="text-accent" />
            {t("settings.debugMode")}
          </h2>
          <button
            onClick={toggleDebugMode}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
              debugMode
                ? "border-accent bg-accent/10"
                : "border-border hover:border-accent/50"
            }`}
          >
            <div className="text-left">
              <p className="font-semibold text-foreground">{t("settings.debug")}</p>
              <p className="text-xs text-muted">
                {debugMode ? t("settings.debugOn") : t("settings.debugOff")} {t("settings.debugDesc")}
              </p>
            </div>
            <span
              className={`w-12 h-6 rounded-full transition relative ${
                debugMode ? "bg-accent" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  debugMode ? "translate-x-6" : ""
                }`}
              />
            </span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted">
            Unyvox v0.1.0
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

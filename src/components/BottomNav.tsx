"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusSquare, MessageCircle, User, Settings, Bookmark, Globe } from "lucide-react";
import Image from "next/image";
import { useSocket } from "./SocketProvider";
import { useTranslation, Language, languageMeta } from "@/lib/i18n";

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", it: "🇮🇹", hi: "🇮🇳", es: "🇪🇸", de: "🇩🇪",
  zh: "🇨🇳", ja: "🇯🇵", pt: "🇵🇹", ar: "🇸🇦", uk: "🇺🇦",
};

const navItems = [
  { href: "/", icon: Home, labelKey: "nav.home" },
  { href: "/explore", icon: Search, labelKey: "nav.explore" },
  { href: "/create", icon: PlusSquare, labelKey: "nav.create" },
  { href: "/saved", icon: Bookmark, labelKey: "nav.saved" },
  { href: "/messages", icon: MessageCircle, labelKey: "nav.messages", badgeKey: "messages" },
  { href: "/profile", icon: User, labelKey: "nav.profile" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
];

function LanguageMenu({
  language,
  setLanguage,
  onClose,
  variant,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
  onClose: () => void;
  variant: "mobile" | "desktop";
}) {
  const { t } = useTranslation();
  const [searchLang, setSearchLang] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allLangs = Object.keys(languageMeta) as Language[];
  const filtered = searchLang.trim()
    ? allLangs.filter((l) => {
        const q = searchLang.toLowerCase();
        const meta = languageMeta[l];
        return (
          l.includes(q) ||
          meta.label.toLowerCase().includes(q) ||
          meta.nativeLabel.toLowerCase().includes(q)
        );
      })
    : allLangs;

  const containerClass =
    variant === "mobile"
      ? "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[180px] max-h-[320px]"
      : "absolute right-16 bottom-0 min-w-[200px] max-h-[400px]";

  return (
    <div
      className={`${containerClass} bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col`}
    >
      {/* Search bar */}
      <div className="p-2 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={searchLang}
          onChange={(e) => setSearchLang(e.target.value)}
          placeholder={t("common.search") + "..."}
          className="w-full bg-background text-foreground rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted"
        />
      </div>

      {/* Language list */}
      <div className="overflow-y-auto py-1 flex-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted text-center">
            {t("common.noResults")}
          </p>
        ) : (
          filtered.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`w-full text-left px-4 py-2 text-sm transition hover:bg-muted/10 flex items-center gap-2 ${
                language === lang
                  ? "text-accent font-semibold"
                  : "text-foreground"
              }`}
            >
              <span className="text-base">{LANG_FLAGS[lang] || ""}</span>
              {variant === "desktop" ? (
                <div className="flex flex-col">
                  <span>{languageMeta[lang].nativeLabel}</span>
                  <span className="text-[10px] text-muted">
                    {languageMeta[lang].label}
                  </span>
                </div>
              ) : (
                <span>{languageMeta[lang].nativeLabel}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { socket } = useSocket();
  const { t, language, setLanguage } = useTranslation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages");
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.conversations || []).reduce(
          (sum: number, c: any) => sum + (c.unreadCount || 0),
          0
        );
        setUnreadMessages(count);
      } catch (error) {
        console.error("BottomNav unread fetch error:", error);
      }
    };

    fetchUnread();

    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      setUnreadMessages((prev) => prev + 1);
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]);

  return (
    <>
      {/* Mobile: bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/90 backdrop-blur-md border-t border-border flex items-center justify-around px-2 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={t(item.labelKey)}
            className={`relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition ${
              pathname === item.href
                ? "text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] leading-none">{t(item.labelKey)}</span>
            {item.badgeKey === "messages" && unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </Link>
        ))}
        {/* Language button on mobile */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((prev) => !prev)}
            className="relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition text-muted hover:text-foreground"
            title={t("nav.language")}
          >
            <Globe size={22} />
            <span className="text-[10px] leading-none">{language.toUpperCase()}</span>
          </button>
          {showLangMenu && (
            <LanguageMenu
              language={language}
              setLanguage={(l) => { setLanguage(l); setShowLangMenu(false); }}
              onClose={() => setShowLangMenu(false)}
              variant="mobile"
            />
          )}
        </div>
      </nav>

      {/* Desktop: right sidebar */}
      <nav className="fixed right-0 top-0 h-screen w-16 bg-background/90 backdrop-blur-md border-l border-border z-50 hidden lg:flex flex-col items-center py-8 gap-6">
        <div className="mb-4 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Unyvox"
            width={28}
            height={28}
            className="object-contain"
            unoptimized
          />
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={t(item.labelKey)}
            className={`relative p-3 rounded-xl transition ${
              pathname === item.href
                ? "text-accent bg-accent/10"
                : "text-muted hover:text-foreground hover:bg-muted/10"
            }`}
          >
            <item.icon size={24} />
            {item.badgeKey === "messages" && unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </Link>
        ))}
        {/* Language button on desktop */}
        <div className="relative mt-auto mb-4">
          <button
            onClick={() => setShowLangMenu((prev) => !prev)}
            className={`relative p-3 rounded-xl transition ${
              showLangMenu ? "text-accent bg-accent/10" : "text-muted hover:text-foreground hover:bg-muted/10"
            }`}
            title={t("nav.language")}
          >
            <Globe size={24} />
          </button>
          {showLangMenu && (
            <LanguageMenu
              language={language}
              setLanguage={(l) => { setLanguage(l); setShowLangMenu(false); }}
              onClose={() => setShowLangMenu(false)}
              variant="desktop"
            />
          )}
        </div>
      </nav>
    </>
  );
}

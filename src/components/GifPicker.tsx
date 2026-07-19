"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, ImageIcon, AlertCircle, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface GifResult {
  id: string;
  url: string;
  preview: string;
  title: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const searchGifs = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q, offset: "0" });
      const res = await fetch(`/api/gifs/search?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore");
      }
      const data = await res.json();
      setGifs(data.gifs || []);
    } catch (err: any) {
      setError(err.message);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carica trending all'apertura
  useEffect(() => {
    searchGifs("");
    searchInputRef.current?.focus();
  }, [searchGifs]);

  // Debounce della ricerca
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchGifs(query);
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, searchGifs]);

  // Navigazione da tastiera
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cols = 3;
    const total = gifs.length;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, total - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + cols, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - cols, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const gif = gifs[selectedIndex];
      if (gif) onSelect(gif.url);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex >= 0 && gridRef.current) {
      const items = gridRef.current.querySelectorAll<HTMLButtonElement>("[data-index]");
      items[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  return (
    <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm">
      {/* Header con search */}
      <div className="p-3 border-b border-border flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-background rounded-xl px-3 py-2">
          <Search size={16} className="text-muted flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("gifPicker.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-muted hover:text-foreground hover:bg-muted/10 rounded-lg transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Grid GIF */}
      <div
        ref={gridRef}
        className="overflow-y-auto max-h-80 p-2"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted">
            <AlertCircle size={32} className="mb-3 text-red-400" />
            <p className="text-sm text-center mb-2">{error}</p>
            <p className="text-xs text-center">                  <span className="text-xs">{t("gifPicker.apiKeyMissing")}</span>
            </p>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted">
            <ImageIcon size={32} className="mb-3 opacity-50" />
            <p className="text-sm">{t("gifPicker.noResults")}</p>
            {!query && <p className="text-xs mt-1">{t("gifPicker.searchHint")}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map((gif, index) => (
              <button
                key={gif.id}
                data-index={index}
                onClick={() => onSelect(gif.url)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`relative aspect-video rounded-lg overflow-hidden bg-muted/20 transition ring-2 ring-transparent hover:ring-accent focus:ring-accent focus:outline-none ${
                  selectedIndex === index ? "ring-accent scale-[1.02]" : ""
                }`}
                title={gif.title || "GIF"}
              >
                <img
                  src={gif.preview}
                  alt={gif.title || "GIF"}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border flex items-center justify-between px-3">
        <p className="text-[10px] text-muted">                  {gifs.length > 0 && !loading && `${gifs.length} GIF`}
        </p>
        {selectedIndex >= 0 && gifs[selectedIndex] && (
          <p className="text-[10px] text-accent truncate max-w-[200px]">
            {gifs[selectedIndex].title || "GIF"}
          </p>
        )}
      </div>
    </div>
  );
}

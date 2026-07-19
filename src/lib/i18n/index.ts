"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  createElement,
} from "react";
import en from "./en.json";
import it from "./it.json";
import hi from "./hi.json";
import es from "./es.json";
import de from "./de.json";
import zh from "./zh.json";
import ja from "./ja.json";
import pt from "./pt.json";
import ar from "./ar.json";
import uk from "./uk.json";
import {
  it as dateFnsIt,
  enUS,
  es as dateFnsEs,
  de as dateFnsDe,
  hi as dateFnsHi,
  zhCN,
  ja as dateFnsJa,
  ptBR,
  ar as dateFnsAr,
  uk as dateFnsUk,
} from "date-fns/locale";

export type Language = "en" | "it" | "hi" | "es" | "de" | "zh" | "ja" | "pt" | "ar" | "uk";

const translations: Record<string, any> = { en, it, hi, es, de, zh, ja, pt, ar, uk };

const dateFnsLocales: Record<string, any> = {
  en: enUS,
  it: dateFnsIt,
  hi: dateFnsHi,
  es: dateFnsEs,
  de: dateFnsDe,
  zh: zhCN,
  ja: dateFnsJa,
  pt: ptBR,
  ar: dateFnsAr,
  uk: dateFnsUk,
};

export const languageMeta: Record<
  string,
  { label: string; nativeLabel: string; dir: "ltr" | "rtl" }
> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr" },
  it: { label: "Italian", nativeLabel: "Italiano", dir: "ltr" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी", dir: "ltr" },
  es: { label: "Spanish", nativeLabel: "Español", dir: "ltr" },
  de: { label: "German", nativeLabel: "Deutsch", dir: "ltr" },
  zh: { label: "Chinese", nativeLabel: "中文", dir: "ltr" },
  ja: { label: "Japanese", nativeLabel: "日本語", dir: "ltr" },
  pt: { label: "Portuguese", nativeLabel: "Português", dir: "ltr" },
  ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
  uk: { label: "Ukrainian", nativeLabel: "Українська", dir: "ltr" },
};

const STORAGE_KEY = "unyvox-language";

function getValue(obj: any, path: string): string | undefined {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return typeof cur === "string" ? cur : undefined;
}

function translate(
  lang: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = translations[lang] || translations.en;
  let val = getValue(dict, key);
  if (val === undefined) val = getValue(translations.en, key);
  if (val === undefined) return key;
  if (params) {
    for (const [pk, pv] of Object.entries(params)) {
      val = val.replace(new RegExp(`\\{\\{${pk}\\}\\}`, "g"), String(pv));
    }
  }
  return val;
}

const defaultT = (key: string) => translate("en", key);

interface LangCtx {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dateFnsLocale: any;
}

const LangContext = createContext<LangCtx>({
  language: "en",
  setLanguage: () => {},
  t: defaultT,
  dateFnsLocale: enUS,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) setLang(stored as Language);
    setReady(true);
  }, []);

  const changeLang = useCallback((l: Language) => {
    setLang(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
    document.documentElement.dir = languageMeta[l]?.dir || "ltr";
  }, []);

  useEffect(() => {
    if (ready) {
      document.documentElement.lang = lang;
      document.documentElement.dir = languageMeta[lang]?.dir || "ltr";
    }
  }, [lang, ready]);

  const tFn = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang]
  );

  const dl = dateFnsLocales[lang] || enUS;

  const ctxValue: LangCtx = {
    language: lang,
    setLanguage: changeLang,
    t: ready ? tFn : defaultT,
    dateFnsLocale: dl,
  };

  return createElement(LangContext.Provider, { value: ctxValue }, children);
}

export function useTranslation() {
  const ctx = useContext(LangContext);
  return {
    t: ctx.t,
    language: ctx.language,
    setLanguage: ctx.setLanguage,
    dateFnsLocale: ctx.dateFnsLocale,
  };
}

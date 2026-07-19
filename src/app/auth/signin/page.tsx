"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

function SessionExpiredMessage({ error }: { error: string }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const sessionExpired =
    searchParams.get("error") === "SessionExpired" || error === "SessionExpired";

  if (!sessionExpired) return null;

  return (
    <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl text-sm text-center">
      {t("auth.sessionExpired")}
    </div>
  );
}

export default function SignIn() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    username: "",
    identifier: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ipLoading, setIpLoading] = useState(true);
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    // Se l'utente è già autenticato, non tentare il login automatico
    if (status === "authenticated") {
      router.push("/");
      return;
    }

    // Prova il login automatico basato su IP/dispositivo (cookie httpOnly)
    const tryIpLogin = async () => {
      try {
        const result = await signIn("ip-login", {
          redirect: false,
        });

        if (result?.ok && !result?.error) {
          router.push("/");
          router.refresh();
          return;
        }
      } catch (err) {
        console.error("IP login error:", err);
      } finally {
        setIpLoading(false);
      }
    };

    tryIpLogin();
  }, [router, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isLogin) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.identifier,
          password: form.password,
          name: form.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("auth.registrationError"));
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email: form.identifier.trim(),
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border p-8 rounded-2xl shadow-xl">
          <div className="flex flex-col items-center mb-4">
            <Image
              src="/logo.png"
              alt="Unyvox"
              width={64}
              height={64}
              className="object-contain mb-2"
              unoptimized
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Unyvox
            </h1>
          </div>
          <p className="text-center text-zinc-400 mb-8 text-sm">
            {isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}
          </p>

          <Suspense fallback={null}>
            <SessionExpiredMessage error={error} />
          </Suspense>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <input
                  type="text"
                  placeholder={t("auth.fullName")}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-accent"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={t("auth.username")}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder-muted focus:outline-none focus:border-accent"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  required
                />
              </>
            )}
            <input
              type="text"
              placeholder={t("auth.emailOrUsername")}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
              value={form.identifier}
              onChange={(e) =>
                setForm({ ...form, identifier: e.target.value })
              }
              required
            />
            <input
              type="password"
              placeholder={t("auth.password")}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-semibold text-white disabled:opacity-50 hover:opacity-90 transition"
            >
              {loading ? t("auth.loading") : isLogin ? t("auth.signIn") : t("auth.signUp")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-accent text-sm hover:underline"
            >
              {isLogin
                ? t("auth.noAccount")
                : t("auth.hasAccount")}
            </button>
          </div>
        </div>

        <p className="text-center text-muted text-xs mt-8">
          {t("common.demoUser")}
        </p>
      </div>
    </div>
  );
}

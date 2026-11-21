"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Events, getAttribution, identify, track } from "@/lib/analytics";
import { authReturnTo } from "@/lib/auth-return";

export function AuthForm({ mode, returnTo }: { mode: "login" | "signup"; returnTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: { source: getAttribution().source } } })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setError("Check your email to confirm your account, then return here to sign in.");
      setLoading(false);
      return;
    }
    if (data.user) identify(data.user.id, email);
    track(mode === "signup" ? Events.signup : Events.login);
    router.push(authReturnTo(returnTo));
    router.refresh();
  }

  const isSignup = mode === "signup";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email" required aria-label="Email address" autoComplete="email" placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          type="password" required aria-label="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} placeholder="Password (min 6 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-black px-3 py-2 font-medium text-white disabled:opacity-50">
          {loading ? "..." : isSignup ? "Sign up" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        {isSignup ? "Already have an account? " : "No account yet? "}
        <Link href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(authReturnTo(returnTo))}`} className="underline">
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </main>
  );
}

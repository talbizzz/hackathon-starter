"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Events, identify, track } from "@/lib/analytics";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
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
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      // Means email confirmation is still ON in Supabase.
      setError("Account created but no session: turn off 'Confirm email' in Supabase Auth settings.");
      setLoading(false);
      return;
    }
    if (data.user) identify(data.user.id, email);
    track(mode === "signup" ? Events.signup : Events.login);
    router.push("/dashboard");
    router.refresh();
  }

  const isSignup = mode === "signup";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email" required placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          type="password" required minLength={6} placeholder="Password (min 6 chars)" value={password}
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
        <Link href={isSignup ? "/login" : "/signup"} className="underline">
          {isSignup ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </main>
  );
}

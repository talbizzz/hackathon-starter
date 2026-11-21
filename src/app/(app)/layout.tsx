import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

// Protected route group: add new app pages under src/app/(app)/ and add the path to PROTECTED in src/proxy.ts.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", data.user.id).single();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">{siteConfig.name}</Link>
            <Link href="/dashboard" className="text-sm text-neutral-600 hover:text-black">Dashboard</Link>
            <Link href="/admin" className="text-sm text-neutral-600 hover:text-black">Spot videos</Link>
            <Link href="/stats" className="text-sm text-neutral-600 hover:text-black">Stats</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">{profile?.display_name ?? data.user.email}</span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

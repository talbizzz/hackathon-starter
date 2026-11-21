"use client";

import Link from "next/link";
import { LangToggle } from "@/components/lang-toggle";
import { siteConfig } from "@/lib/site-config";
import { useT } from "@/lib/i18n";

export function SiteHeader() {
  const { lang } = useT();
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        {siteConfig.name}
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/plans/kreuzberg-sunday" className="text-sm underline underline-offset-4">{lang === "de" ? "Sonntagsplan · 3,99 €" : "Sunday plan · €3.99"}</Link>
        <LangToggle />
      </div>
    </header>
  );
}

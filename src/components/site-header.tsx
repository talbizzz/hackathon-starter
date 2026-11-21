"use client";

import Link from "next/link";
import { LangToggle } from "@/components/lang-toggle";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        {siteConfig.name}
      </Link>
      <LangToggle />
    </header>
  );
}

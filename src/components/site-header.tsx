"use client";

import Link from "next/link";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-4">
      <Link href="/" aria-label={siteConfig.name}>
        <Logo />
      </Link>
      <LangToggle />
    </header>
  );
}

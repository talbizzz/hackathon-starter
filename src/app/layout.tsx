import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/site-config";
import { env } from "@/lib/env";
import { SITE_ORIGIN, siteRobots } from "@/lib/seo";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: `${siteConfig.name}: ${siteConfig.tagline}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  robots: siteRobots(env.NEXT_PUBLIC_SITE_URL),
  openGraph: { title: siteConfig.name, description: siteConfig.description, type: "website", url: "/", siteName: siteConfig.name },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-white text-ink antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

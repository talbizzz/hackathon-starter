import { Montserrat } from "next/font/google";
import { siteConfig } from "@/lib/site-config";

// The brand wordmark is Montserrat Bold.
const montserrat = Montserrat({ subsets: ["latin"], weight: "700" });

// The raspberry of the logo file itself, measured from the artwork.
const LOGO_RASPBERRY = "#c54a67";

/** The app icon: a map pin with a play button, on a raspberry rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 530 530" className={className} aria-hidden>
      <rect width="530" height="530" rx="76" fill={LOGO_RASPBERRY} />
      <path
        d="M348.44 311.44 L281.97 377.91 A24 24 0 0 1 248.03 377.91 L181.56 311.44 A118 118 0 1 1 348.44 311.44 Z"
        fill="#fff"
      />
      <circle cx="265" cy="422.5" r="21.75" fill="#fff" />
      <polygon points="243,188 243,255 302,221.5" fill={LOGO_RASPBERRY} stroke={LOGO_RASPBERRY} strokeWidth="14" strokeLinejoin="round" />
    </svg>
  );
}

/** The icon followed by the name, for headers on light backgrounds. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7 shrink-0" />
      <span className={`${montserrat.className} text-xl leading-none text-ink`}>{siteConfig.name}</span>
    </span>
  );
}

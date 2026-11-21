import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.name;

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0a0a0a", color: "white" }}>
        <div style={{ fontSize: 84, fontWeight: 700 }}>{siteConfig.name}</div>
        <div style={{ fontSize: 40, marginTop: 24, color: "#a3a3a3" }}>{siteConfig.tagline}</div>
      </div>
    ),
    size,
  );
}

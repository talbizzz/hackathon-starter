import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      // Also covers preview aliases of a build configured with the production URL.
      { source: "/:path*", missing: [{ type: "host", value: "nebenmir\\.app" }], headers: noindex },
      ...["/login", "/signup", "/dashboard", "/admin", "/stats", "/p", "/api"].map((path) => ({
        source: `${path}/:path*`, headers: noindex,
      })),
    ];
  },
  // Dev only: lets a phone on the same Wi-Fi load the dev server (http://192.168.x.x:3000).
  allowedDevOrigins: ["192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

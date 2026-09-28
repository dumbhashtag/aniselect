import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AniList/MAL already serve appropriately sized CDN images, so we skip
    // the optimizer instead of re-encoding hundreds of posters server-side.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "img.anili.st" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;

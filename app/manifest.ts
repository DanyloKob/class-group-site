import type { MetadataRoute } from "next";

// iOS Safari only allows web push after the site is added to the home
// screen as an installed PWA - this manifest is what makes "Add to Home
// Screen" produce a real app-like icon/launch instead of a bare bookmark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "L-23 LIFE",
    short_name: "L-23 LIFE",
    description: "Сайт групи L-23",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d0b",
    theme_color: "#0a0d0b",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/emblem.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import type { MetadataRoute } from "next";

// Lets the class add the site to the home screen as an app.
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

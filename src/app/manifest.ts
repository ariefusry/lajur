import type { MetadataRoute } from "next";

/** Lets phones install Lamarin to the home screen (icons from docs/brand). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lamarin",
    short_name: "Lamarin",
    description: "Tracker lamaran kerja: tahap seleksi, deadline, dan jadwal tes di satu tempat.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f6f8",
    theme_color: "#0069E8",
    lang: "id",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

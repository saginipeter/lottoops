import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LottoOps Employee",
    short_name: "LottoOps",
    description: "Fast lottery scanning, shift control, and inventory audits for store employees.",
    start_url: "/employee",
    display: "standalone",
    background_color: "#17233F",
    theme_color: "#17233F",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      { src: "/brand/lottoops-pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/lottoops-pwa-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/lottoops-pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/lottoops-pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

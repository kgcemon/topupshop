import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Uc Ghor - Free Fire Diamond TopUp",
    short_name: "Uc Ghor",
    description: "Largest Free Fire Diamond TopUp site in Bangladesh.",
    start_url: "/",
    display: "standalone",
    background_color: "#edf4ff",
    theme_color: "#14d72b",
    icons: [
      { src: "/images/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/images/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

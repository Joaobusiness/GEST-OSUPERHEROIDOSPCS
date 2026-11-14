import type { MetadataRoute } from "next";

// Público: sem dados de empresa ou usuário. O service worker (public/sw.js) só cacheia assets estáticos; nada autenticado em cache.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Super Herói dos PCs",
    short_name: "Super Herói",
    description: "Gestão de assistência técnica: clientes, orçamentos, preço certo e financeiro.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    icons: [
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

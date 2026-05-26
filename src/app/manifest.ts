import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LENDAS 2018",
    short_name: "LENDAS",
    description: "Pedidos de mesa, cozinha e painel administrativo em tempo real.",
    start_url: "/mesa/12",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    orientation: "portrait",
    icons: [
      {
        src: "/lendas-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/lendas-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Mesa 12",
        short_name: "Mesa",
        url: "/mesa/12"
      },
      {
        name: "Cozinha",
        short_name: "Cozinha",
        url: "/kitchen"
      },
      {
        name: "Admin",
        short_name: "Admin",
        url: "/admin"
      }
    ]
  };
}

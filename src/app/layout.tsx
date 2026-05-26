import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/lendas/pwa-register";

export const metadata: Metadata = {
  title: "LENDAS 2018",
  description: "Premium realtime restaurant operating system",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LENDAS 2018"
  }
};

export const viewport: Viewport = {
  themeColor: "#050505"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

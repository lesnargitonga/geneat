import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ThemeScript } from "@/components/ThemeScript";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_HAZINA_PORTAL_URL || "https://hazina.lesnarai.co.ke"),
  title: "Hazina Nomads · Curated Kenyan gift boxes",
  description:
    "Premium gift concierge for travellers in Nairobi. Curated Kenyan treasures delivered to your hotel or JKIA before you fly home.",
};

export const viewport: Viewport = {
  themeColor: "#1C1A17",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-sand text-ink font-sans font-normal antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

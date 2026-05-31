import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hazina Nomads · Curated Kenyan gift boxes",
  description:
    "Premium gift concierge for travellers in Nairobi. Curated Kenyan treasures delivered to your hotel or JKIA before you fly home.",
};

export const viewport: Viewport = {
  themeColor: "#C45C3E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Bricolage+Grotesque:wght@600;700;800&display=swap"
        />
      </head>
      <body>
        <Nav />
        <main className="container-page pt-8 md:pt-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

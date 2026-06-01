import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

const themeInitScript = `(() => {
  try {
    const stored = window.localStorage.getItem("hazina.theme");
    const prefersNight = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersNight ? "night" : "day");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "day";
  }
})();`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_HAZINA_PORTAL_URL || "https://hazina.lesnarai.co.ke"),
  title: "Hazina Nomads · Curated Kenyan gift boxes",
  description:
    "Premium gift concierge for travellers in Nairobi. Curated Kenyan treasures delivered to your hotel, JKIA, or quoted for insured DHL export.",
};

export const viewport: Viewport = {
  themeColor: "#1C1A17",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-sand text-ink font-sans font-normal antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { SiteChrome } from "@/components/SiteChrome";
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
  title: "Hazina Nomads · Private Sourcing Concierge",
  description:
    "Bespoke Kenyan treasures, curated for your journey through private sourcing, seamless logistics, and global export.",
};

export const viewport: Viewport = {
  themeColor: "#0D1B14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/brand/safari-sunset.webp" as="image" type="image/webp" />
      </head>
      <body className="min-h-screen flex flex-col bg-sand text-ink font-sans font-normal antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}

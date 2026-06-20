import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Mono, Manrope } from "next/font/google";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";

// Display serif — the brand's editorial voice (headlines, hero, exhibit titles).
// Only 400/500 (+ italic for the wordmark) are used, so we ship just those.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

// Body sans — clean, warm humanist grotesque that pairs with Cormorant
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

// Mono — labels, SKUs, the "museum placard" detail type
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

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

const SITE_URL = process.env.PUBLIC_HAZINA_PORTAL_URL || "https://hazina.lesnarai.co.ke";
const SITE_NAME = "Hazina Nomads";
const SITE_TAGLINE = "Private Sourcing Concierge";
const SITE_DESCRIPTION =
  "Bespoke Kenyan treasures, curated for your journey through private sourcing, seamless logistics, and global export.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Kenyan gifts",
    "private sourcing",
    "luxury concierge Kenya",
    "safari souvenirs Nairobi",
    "African heritage gifts",
    "corporate gifting Kenya",
    "global export",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/brand/safari-sunset.webp",
        width: 1200,
        height: 630,
        alt: "Hazina Nomads — bespoke Kenyan treasures, curated for the journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/brand/safari-sunset.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "shopping",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2ECE2" },
    { media: "(prefers-color-scheme: dark)", color: "#080807" },
  ],
  colorScheme: "light dark",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  logo: `${SITE_URL}/brand/safari-sunset.webp`,
  areaServed: "Worldwide",
  knowsAbout: ["Kenyan crafts", "Private sourcing", "Luxury gifting", "Global export"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${cormorant.variable} ${manrope.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href="/brand/safari-sunset.webp" as="image" type="image/webp" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-sand text-ink font-sans font-normal antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}

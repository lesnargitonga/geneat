import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerLoginForm } from "@/components/PartnerLoginForm";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { partnerPortalConfigured } from "@/lib/partner-session";
import { BRAND } from "@/lib/products";

export const metadata: Metadata = {
  title: "Partner sign-in · Hazina Nomads",
  description: "Private partner portal for Hazina Nomads referral partners.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PartnerLoginPage() {
  const configured = partnerPortalConfigured();

  return (
    <SpatialPage>
      <section className="container-page py-16 md:py-24 max-w-lg mx-auto">
        <RevealText>
          <span className="label-mono">Partner portal</span>
        </RevealText>
        <RevealText delay={0.08}>
          <h1 className="font-serif text-4xl md:text-5xl text-obsidian mt-3 leading-tight">
            Sign in to your dashboard
          </h1>
        </RevealText>
        <RevealText delay={0.14}>
          <p className="text-ink-mute mt-4 leading-relaxed">
            Access is by invitation only. If you are a hotel, host, guide, or agent we have onboarded,
            use the credentials Hazina sent you.
          </p>
        </RevealText>

        <FloatingSurface className="mt-10">
          {configured ? (
            <Suspense fallback={<p className="text-sm text-ink-mute">Loading…</p>}>
              <PartnerLoginForm />
            </Suspense>
          ) : (
            <p className="text-sm text-ink-mute leading-relaxed border-l-2 border-bronze pl-4">
              Portal credentials are issued after approval. Email{" "}
              <a href={`mailto:${BRAND.email}`} className="text-bronze hover:text-obsidian">
                {BRAND.email}
              </a>{" "}
              to request partner access.
            </p>
          )}
        </FloatingSurface>

        <p className="mt-12 text-sm text-ink-mute">
          <Link href="/collections" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
            Guest collections
          </Link>{" "}
          — for travellers browsing the public site.
        </p>
      </section>
    </SpatialPage>
  );
}

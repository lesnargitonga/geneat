import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";
import { PartnerSignOutButton } from "@/components/PartnerSignOutButton";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import { RevealGroup } from "@/components/three-d/RevealGroup";
import { RevealText } from "@/components/three-d/RevealText";
import { SpatialPage } from "@/components/three-d/SpatialPage";

export const metadata: Metadata = {
  title: "Partner dashboard · Hazina Nomads",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PartnerDashboardPage() {
  const referralCode =
    process.env.PARTNER_REFERRAL_CODE?.trim() || "REF-HOST-PENDING";
  const kitWa = whatsappLink(
    BRAND.whatsapp,
    `Hello Hazina Nomads — I'm partner ${referralCode} and need my referral kit or payout summary.`,
  );

  return (
    <SpatialPage>
    <div className="container-page py-10 md:py-16 pb-20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-12">
        <div>
          <RevealText>
            <span className="label-mono">Partner dashboard</span>
          </RevealText>
          <RevealText delay={0.07}>
            <h1 className="font-serif text-4xl md:text-5xl text-obsidian mt-2">Your referral desk</h1>
          </RevealText>
          <RevealText delay={0.14}>
            <p className="text-ink-mute mt-3 max-w-xl leading-relaxed">
              Track tagged orders and request kits. Guest-facing pricing never shows commission — only
              this portal does.
            </p>
          </RevealText>
        </div>
        <PartnerSignOutButton />
      </div>

      <RevealGroup className="grid gap-6 md:grid-cols-3 mb-12">
        <DashboardStat label="Your referral code" value={referralCode} />
        <DashboardStat label="Commission" value="15%" />
        <DashboardStat label="Payout status" value="Contact concierge" />
      </RevealGroup>

      <FloatingSurface className="panel-luxury p-6 md:p-8 space-y-4 mb-8">
        <h2 className="font-serif text-2xl text-obsidian">Earnings</h2>
        <p className="text-ink-mute text-sm leading-relaxed">
          Order-level reporting will appear here once your referral code is live in production.
          Until then, message concierge for a manual statement.
        </p>
        <p className="font-mono text-3xl text-obsidian">KES 0 · USD 0</p>
        <p className="label-mono text-ink-mute">No tagged sales recorded yet</p>
      </FloatingSurface>

      <RevealGroup className="grid gap-4 md:grid-cols-2">
        <LuxuryTilt>
        <a
          href={kitWa}
          target="_blank"
          rel="noopener noreferrer"
          className="card-luxury p-6 hover:border-obsidian/30 transition-colors"
        >
          <span className="label-mono text-bronze">Concierge</span>
          <p className="font-serif text-xl text-obsidian mt-2">Request partner kit</p>
          <p className="text-sm text-ink-mute mt-2">QR cards, guest scripts, tracking setup.</p>
        </a>
        </LuxuryTilt>
        <LuxuryTilt>
        <Link
          href="/hosts-guides"
          className="card-luxury p-6 hover:border-obsidian/30 transition-colors"
        >
          <span className="label-mono text-bronze">Program</span>
          <p className="font-serif text-xl text-obsidian mt-2">Review partner overview</p>
          <p className="text-sm text-ink-mute mt-2">Commission model and who it is for.</p>
        </Link>
        </LuxuryTilt>
      </RevealGroup>
    </div>
    </SpatialPage>
  );
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-5 md:p-6">
      <p className="label-mono text-ink-mute">{label}</p>
      <p className="font-serif text-2xl text-obsidian mt-2 break-all">{value}</p>
    </div>
  );
}

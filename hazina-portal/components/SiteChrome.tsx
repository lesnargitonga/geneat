"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

/** Magic-link order pages ship without main marketing chrome. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isOrderTracking = pathname.startsWith("/orders");

  if (isOrderTracking) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { MagneticCursor } from "@/components/three-d/MagneticCursor";
import { ShowroomShell } from "@/components/three-d/ShowroomShell";
import { ORDERING_OPEN } from "@/lib/products";

/** Magic-link order pages ship without main marketing chrome. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isOrderTracking = pathname.startsWith("/orders");

  if (isOrderTracking) {
    return <>{children}</>;
  }

  return (
    <>
      <ShowroomShell />
      <Nav />
      <main className="showroom-main flex-1">{children}</main>
      {ORDERING_OPEN ? <ChatWidget /> : null}
      <MagneticCursor />
      <Footer />
    </>
  );
}

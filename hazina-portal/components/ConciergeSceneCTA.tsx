"use client";

import { openConciergeChat } from "@/components/ChatWidget";
import { ORDERING_OPEN } from "@/lib/products";

export function ConciergeSceneCTA() {
  if (!ORDERING_OPEN) return null;
  return (
    <button type="button" className="btn-bronze" onClick={openConciergeChat} data-cursor="magnetic">
      Open guided concierge
    </button>
  );
}

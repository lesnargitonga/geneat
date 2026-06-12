"use client";

import { openConciergeChat } from "@/components/ChatWidget";

export function ConciergeSceneCTA() {
  return (
    <button type="button" className="btn-bronze" onClick={openConciergeChat}>
      Open guided concierge
    </button>
  );
}

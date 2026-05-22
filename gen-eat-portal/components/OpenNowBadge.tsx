import { Cafe, isOpenNow } from "@/lib/cafes";

export function OpenNowBadge({ cafe }: { cafe: Cafe }) {
  const open = isOpenNow(cafe);
  return open ? (
    <span className="chip-ok">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Open now
    </span>
  ) : (
    <span className="chip-mute">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-mute" />
      Closed
    </span>
  );
}

import Image from "next/image";
import type { MenuItem } from "@/lib/cafes";

/**
 * Square thumbnail for a menu item.
 * - If `item.image` is set, renders it (next/image).
 * - Otherwise renders an intentional gradient card tinted with the café's
 *   brand color, with the item's emoji centered.
 *
 * Drop a real photo at `public/menu/<cafe-slug>/<item>.jpg` and set
 * `image: "/menu/<cafe-slug>/<item>.jpg"` on the menu item to replace it.
 */
export function MenuItemThumb({
  item,
  accent,
  size = 64,
}: {
  item: MenuItem;
  /** Hex color from cafe.color, used as the gradient accent. */
  accent: string;
  size?: number;
}) {
  if (item.image) {
    return (
      <div
        className="relative shrink-0 overflow-hidden rounded-xl bg-ink/5"
        style={{ width: size, height: size }}
      >
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    );
  }

  // Build a soft two-stop gradient from the café's accent color.
  const bg = `linear-gradient(135deg, ${accent}22 0%, ${accent}55 100%)`;
  return (
    <div
      className="shrink-0 rounded-xl flex items-center justify-center text-2xl ring-1 ring-ink/5"
      style={{ width: size, height: size, background: bg }}
      aria-hidden
    >
      <span className="drop-shadow-sm">{item.emoji ?? "🍽"}</span>
    </div>
  );
}

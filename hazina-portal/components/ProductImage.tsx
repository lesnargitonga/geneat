import Image from "next/image";
import type { GiftBox } from "@/lib/products";

type Props = {
  box: GiftBox;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

export function ProductImage({ box, priority, className = "", sizes }: Props) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden bg-sand-dark ${className}`}>
      <Image
        src={box.image}
        alt={box.imageAlt}
        fill
        className="object-cover"
        sizes={sizes ?? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        priority={priority}
      />
    </div>
  );
}

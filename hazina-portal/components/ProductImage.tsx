import { CatalogImage } from "@/components/CatalogImage";
import type { GiftBox } from "@/lib/products";

type Props = {
  box: GiftBox;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

export function ProductImage({ box, priority, className = "", sizes }: Props) {
  return (
    <CatalogImage
      src={box.image}
      alt={box.imageAlt || box.name}
      tone="warm"
      fit="contain"
      className={`aspect-[4/5] w-full ${className}`}
      sizes={sizes ?? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
      priority={priority}
    />
  );
}

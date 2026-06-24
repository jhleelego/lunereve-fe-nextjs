import Image from "next/image";
import type { Product } from "@/data/products";

type ProductCardProps = {
  product: Product;
  index: number;
};

function ProductInfo({
  product,
  variant,
}: {
  product: Product;
  variant: "mobile" | "desktop";
}) {
  const isMobile = variant === "mobile";

  return (
    <>
      <h2
        className={`mb-4 font-light tracking-wide ${
          isMobile
            ? "text-2xl text-white sm:text-3xl"
            : "mb-6 text-4xl text-neutral-900 lg:text-5xl"
        }`}
      >
        {product.name}
      </h2>
      <p
        className={`mb-6 text-sm leading-relaxed sm:text-base ${
          isMobile ? "text-white/80" : "mb-8 max-w-lg text-neutral-500"
        }`}
      >
        {product.description}
      </p>
      <ul className="flex flex-wrap gap-1.5 sm:gap-3">
        {product.details.map((detail) => (
          <li
            key={detail}
            className={`rounded-full tracking-wide ${
              isMobile
                ? "border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm"
                : "border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600"
            }`}
          >
            {detail}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const isReversed = index % 2 === 1;

  return (
    <article id={product.id} className="group scroll-mt-28">
      <div
        className={`flex flex-col lg:gap-16 ${
          isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
        } lg:items-center`}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 shadow-sm lg:w-1/2 lg:rounded-3xl">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5 lg:hidden" />

          <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-7 sm:p-6 sm:pb-8 lg:hidden">
            <ProductInfo product={product} variant="mobile" />
          </div>
        </div>

        <div className="hidden flex-col justify-center lg:flex lg:w-1/2">
          <ProductInfo product={product} variant="desktop" />
        </div>
      </div>
    </article>
  );
}

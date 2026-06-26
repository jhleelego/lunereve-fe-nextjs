import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";

export default function Home() {
  return (
    <>
      <section id="products" className="scroll-mt-20 pt-20 sm:pt-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 mb-4">
          <div className="flex flex-col gap-16 sm:gap-24 lg:gap-36">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section
        id="about"
        className="scroll-mt-20 border-t border-neutral-100 bg-neutral-50 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <p className="mb-3 text-xs tracking-[0.5em] text-neutral-400 uppercase">
            About
          </p>
          <h2 className="mb-8 font-serif text-3xl font-light tracking-wide text-neutral-900 sm:text-4xl">
            브랜드 스토리
          </h2>
          <p className="mb-6 text-sm leading-[2] text-neutral-500 sm:text-base">
            륀레브(Lunereve)는 달(Lune)과 저녁(Reve)이 만나는 그 순간에서 이름을
            따왔습니다. 일상 속 작은 공간과 순간에 더 나은 경험을 더하는 것,
            그것이 륀레브가 지향하는 방향입니다.
          </p>
          <p className="text-sm leading-[2] text-neutral-500 sm:text-base">
            꼼꼼한 품질 관리와 실용적인 디자인으로, 오래도록 만족스럽게 사용할
            수 있는 좋은 제품을 선보입니다.
          </p>
        </div>
      </section>
    </>
  );
}

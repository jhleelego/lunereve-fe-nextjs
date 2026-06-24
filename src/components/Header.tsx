import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-neutral-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-5 sm:h-20 sm:px-8">
        <Link href="/" className="group flex flex-col items-center">
          <span className="text-lg font-light tracking-[0.35em] text-neutral-800 transition-colors group-hover:text-neutral-500 sm:text-xl">
            륀레브
          </span>
          <span className="text-[10px] tracking-[0.5em] text-neutral-400 uppercase sm:text-xs">
            Lunereve
          </span>
        </Link>
      </div>
    </header>
  );
}

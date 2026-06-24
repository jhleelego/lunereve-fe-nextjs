export default function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-neutral-50">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-12 text-center sm:px-8">
        <p className="text-lg font-light tracking-[0.35em] text-neutral-800">륀레브</p>
        <p className="text-xs tracking-wider text-neutral-400">
          © {new Date().getFullYear()} Lunereve. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

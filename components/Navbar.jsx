import Link from "next/link";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Why Ascend", href: "#why-ascend" },
  { label: "Contact", href: "#contact" }
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between section-pad md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-white md:justify-self-start"
        >
          Ascend
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-white/70 md:flex md:justify-self-center">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex md:justify-self-end">
          <Link
            href="#contact"
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-[#6b3df0]"
          >
            Talk to Us
          </Link>
        </div>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
            Menu
          </summary>
          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-nightSoft p-3 shadow-card">
            <div className="flex flex-col gap-2 text-sm text-white/70">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2 py-1 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="#contact"
                className="rounded-lg bg-accent px-3 py-2 text-center font-semibold text-white"
              >
                Talk to Us
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

import Link from "next/link";
import SearchBar from "@/components/ui/SearchBar";
import HeaderAuth from "@/components/HeaderAuth";

export default function Header() {
  return (
    <header className="border-b border-border bg-surface" role="banner">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-baseline gap-2 transition-opacity hover:opacity-80"
          aria-label="Forever — Home"
        >
          <span className="font-heading text-xl font-semibold text-warm-800">
            Forever
          </span>
          <span className="font-heading text-lg text-gold-500">לעולם</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <SearchBar
            size="sm"
            placeholder="Search memorials..."
            className="hidden w-56 sm:block lg:w-64"
            disabled
            aria-label="Search memorials"
          />

          <HeaderAuth />

          <button
            className="rounded-md px-2 py-1 text-sm font-medium text-warm-500 transition-colors hover:bg-warm-50 hover:text-warm-700"
            aria-label="Switch language"
          >
            EN
          </button>
        </div>
      </nav>
    </header>
  );
}

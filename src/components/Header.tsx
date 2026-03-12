import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SearchBar from "@/components/ui/SearchBar";
import HeaderAuth from "@/components/HeaderAuth";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";

export default async function Header() {
  const [t, locale] = await Promise.all([
    getTranslations("Header"),
    getLocale(),
  ]);

  return (
    <header className="border-b border-border bg-surface" role="banner">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label={t("homeLabel")}
        >
          {/* Mobile: compact wordmark + flourish only */}
          <Logo locale={locale} compact className="sm:hidden" />
          {/* Desktop: full logo with divider + subtitle */}
          <Logo locale={locale} className="hidden sm:block" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile search icon */}
          <Link
            href="/search"
            className="flex size-9 items-center justify-center rounded-lg text-warm-500 transition-colors hover:bg-warm-50 hover:text-warm-700 sm:hidden"
            aria-label={t("searchLabel")}
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </Link>

          {/* Desktop search bar */}
          <SearchBar
            size="sm"
            placeholder={t("searchPlaceholder")}
            className="hidden w-56 sm:block lg:w-64"
            aria-label={t("searchLabel")}
          />

          <HeaderAuth />

          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}

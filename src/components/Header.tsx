import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import SearchBar from "@/components/ui/SearchBar";
import HeaderAuth from "@/components/HeaderAuth";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default async function Header() {
  const t = await getTranslations("Header");

  return (
    <header className="border-b border-border bg-surface" role="banner">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-baseline gap-2 transition-opacity hover:opacity-80"
          aria-label={t("homeLabel")}
        >
          <span className="font-heading text-xl font-semibold text-warm-800">
            {t("home")}
          </span>
          <span className="font-heading text-lg text-gold-500">{t("homeHebrew")}</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
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

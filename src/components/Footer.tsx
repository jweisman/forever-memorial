import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t border-border bg-surface" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <p className="text-sm text-muted">
              <span className="font-heading font-medium text-warm-700">
                {t("brand")}
              </span>{" "}
              <span className="text-gold-500">{t("brandHebrew")}</span>
              {" "}&mdash; {t("tagline")}
            </p>
            <Link
              href="/about"
              className="text-sm text-warm-400 transition-colors hover:text-accent"
            >
              {t("about")}
            </Link>
          </div>
          <p className="text-sm text-warm-400">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}

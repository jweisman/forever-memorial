"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const otherLocale = locale === "en" ? "he" : "en";
  const label = locale === "en" ? "עב" : "EN";

  return (
    <button
      onClick={() => router.replace(pathname, { locale: otherLocale })}
      className="rounded-md px-2 py-1 text-sm font-medium text-warm-500 transition-colors hover:bg-warm-50 hover:text-warm-700"
      aria-label="Switch language"
    >
      {label}
    </button>
  );
}

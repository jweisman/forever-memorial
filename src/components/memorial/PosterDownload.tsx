"use client";

import { useTranslations } from "next-intl";

type Props = {
  memorialId: string;
};

export default function PosterDownload({ memorialId }: Props) {
  const t = useTranslations("Memorial");
  const posterUrl = `/api/memorials/${memorialId}/poster`;

  return (
    <a
      href={posterUrl}
      download
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-warm-700 transition-colors hover:bg-warm-50 hover:text-warm-900"
    >
      <svg
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 17h2m4-4h-4v2m0 4h2v2h2v-4"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 7h.01M17 7h.01M7 17h.01"
        />
      </svg>
      {t("posterLabel")}
    </a>
  );
}

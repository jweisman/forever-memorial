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
      aria-label={t("posterTooltip")}
      className="group relative ms-1.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded p-0.5 text-warm-400 transition-colors hover:text-warm-600"
    >
      {/* QR code icon */}
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 17h2m4-4h-4v2m0 4h2v2h2v-4"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M7 7h.01M17 7h.01M7 17h.01"
        />
      </svg>
      {/* Tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-warm-800 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {t("posterTooltip")}
      </span>
    </a>
  );
}

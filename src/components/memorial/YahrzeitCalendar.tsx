"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";

type Props = {
  memorialId: string;
  memorialName: string;
};

export default function YahrzeitCalendar({ memorialId, memorialName }: Props) {
  const t = useTranslations("Memorial");
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [open, close]);

  const icsUrl = `/api/memorials/${memorialId}/yahrzeit?format=ics`;
  const pdfUrl = `/api/memorials/${memorialId}/yahrzeit?format=pdf`;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label={t("yahrzeitTooltip")}
        className="group relative ms-1.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded p-0.5 text-warm-400 transition-colors hover:text-warm-600"
      >
        {/* Calendar icon */}
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
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {/* Tooltip */}
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-warm-800 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {t("yahrzeitTooltip")}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={t("yahrzeitDialogTitle")}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-warm-800">
                  {t("yahrzeitDialogTitle")}
                </h2>
                <p className="mt-1 text-sm text-warm-500">
                  {t("yahrzeitDialogDesc", { name: memorialName })}
                </p>
              </div>
              <button
                onClick={close}
                className="shrink-0 rounded-full p-1 text-warm-400 hover:text-warm-600"
                aria-label={t("lightboxClose")}
              >
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Download buttons */}
            <div className="mt-6 space-y-3">
              <a
                href={icsUrl}
                download
                className="flex w-full items-center gap-3 rounded-lg border border-warm-200 px-4 py-3 text-sm text-warm-700 transition-colors hover:border-warm-300 hover:bg-warm-50"
              >
                <svg
                  className="size-5 shrink-0 text-gold-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium">{t("yahrzeitIcsTitle")}</div>
                  <div className="text-xs text-warm-400">
                    {t("yahrzeitIcsDesc")}
                  </div>
                </div>
              </a>

              <a
                href={pdfUrl}
                download
                className="flex w-full items-center gap-3 rounded-lg border border-warm-200 px-4 py-3 text-sm text-warm-700 transition-colors hover:border-warm-300 hover:bg-warm-50"
              >
                <svg
                  className="size-5 shrink-0 text-gold-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium">{t("yahrzeitPdfTitle")}</div>
                  <div className="text-xs text-warm-400">
                    {t("yahrzeitPdfDesc")}
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

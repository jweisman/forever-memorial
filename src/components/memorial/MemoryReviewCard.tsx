"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

type MemoryReviewCardProps = {
  memory: {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    status: string;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null; mediaType: "IMAGE" | "VIDEO" }[];
  };
  onReviewed: () => void;
};

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MemoryReviewCard({
  memory,
  onReviewed,
}: MemoryReviewCardProps) {
  const t = useTranslations("MemoryReview");
  const locale = useLocale();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");
  const [acting, setActing] = useState(false);

  async function handleAction(action: "accept" | "ignore" | "return") {
    if (action === "return" && !returnMessage.trim()) return;
    setActing(true);

    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "return" && { returnMessage: returnMessage.trim() }),
        }),
      }
    );

    if (res.ok) {
      onReviewed();
    }
    setActing(false);
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-warm-800">
            {memory.name}
            {memory.withholdName && (
              <span className="ms-2 text-xs text-warm-400">
                {t("wantsAnonymous")}
              </span>
            )}
          </p>
          {memory.relation && (
            <p className="text-xs text-warm-400">{memory.relation}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {memory.status === "IGNORED" && (
            <span className="rounded bg-warm-100 px-2 py-0.5 text-xs text-warm-500">
              {t("ignored")}
            </span>
          )}
          <span className="text-xs text-warm-300">
            {formatDate(memory.createdAt, locale)}
          </span>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
        {memory.text}
      </p>

      {memory.images.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {memory.images.map((img) => (
            <div
              key={img.id}
              className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-warm-100"
            >
              {img.mediaType === "VIDEO" ? (
                <video
                  src={img.thumbUrl}
                  className="size-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={img.thumbUrl}
                  alt={img.caption || t("memoryPhoto")}
                  className="size-full object-cover"
                  loading="lazy"
                />
              )}
              {img.mediaType === "VIDEO" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/50 p-1">
                    <svg className="size-3 text-white" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 2l10 6-10 6z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Return message form */}
      {showReturnForm && (
        <div className="mt-3">
          <textarea
            value={returnMessage}
            onChange={(e) => setReturnMessage(e.target.value)}
            placeholder={t("returnPlaceholder")}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-warm-800 placeholder-warm-400 focus:border-accent focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction("return")}
              disabled={acting || !returnMessage.trim()}
            >
              {t("sendBack")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReturnForm(false);
                setReturnMessage("");
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showReturnForm && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleAction("accept")}
            disabled={acting}
          >
            {t("accept")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction("ignore")}
            disabled={acting}
          >
            {t("ignore")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-600 hover:text-amber-700"
            onClick={() => setShowReturnForm(true)}
            disabled={acting}
          >
            {t("return")}
          </Button>
        </div>
      )}
    </div>
  );
}

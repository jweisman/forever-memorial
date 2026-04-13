"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Lightbox from "./Lightbox";
import VideoThumbnail from "./VideoThumbnail";

export type MediaItem = {
  id: string;
  thumbUrl: string;
  url: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO";
};

type MediaThumbnailGridProps = {
  items: MediaItem[];
  altText?: string;
};

export default function MediaThumbnailGrid({
  items,
  altText,
}: MediaThumbnailGridProps) {
  const t = useTranslations("Memorial");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {items.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-100"
          >
            {img.mediaType === "VIDEO" ? (
              <VideoThumbnail
                src={img.thumbUrl}
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <img
                src={img.thumbUrl}
                alt={img.caption || altText || t("memoryPhoto")}
                className="size-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            )}
            {img.mediaType === "VIDEO" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/50 p-1.5">
                  <svg
                    className="size-4 text-white"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M4 2l10 6-10 6z" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={items}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}

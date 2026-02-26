"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import CollapsibleText from "@/components/ui/CollapsibleText";
import Lightbox from "./Lightbox";

type MemoryCardProps = {
  memory: {
    id: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null }[];
  };
};

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MemoryCard({ memory }: MemoryCardProps) {
  const t = useTranslations("Memorial");
  const locale = useLocale();
  const displayName = memory.withholdName ? t("anonymous") : memory.name;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <Card>
      <blockquote className="border-s-4 border-gold-400 ps-4">
        <CollapsibleText text={memory.text} maxLines={6} />

        {memory.images.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {memory.images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setLightboxIndex(idx)}
                className="group size-20 shrink-0 overflow-hidden rounded-lg bg-warm-100"
              >
                <img
                  src={img.thumbUrl}
                  alt={img.caption || t("memoryPhoto")}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {lightboxIndex !== null && (
          <Lightbox
            images={memory.images}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}

        <footer className="mt-4 text-sm">
          <span className="font-medium text-warm-800">{displayName}</span>
          {memory.relation && (
            <span className="text-warm-400"> — {memory.relation}</span>
          )}
          <span className="ms-2 text-warm-300">
            {formatDate(memory.createdAt, locale)}
          </span>
        </footer>
      </blockquote>
    </Card>
  );
}

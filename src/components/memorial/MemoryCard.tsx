"use client";

import { useLocale, useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import CollapsibleText from "@/components/ui/CollapsibleText";
import MediaThumbnailGrid from "./MediaThumbnailGrid";

type MemoryCardProps = {
  memory: {
    id: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    createdAt: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null; mediaType: "IMAGE" | "VIDEO" }[];
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

  return (
    <Card>
      <blockquote className="border-s-4 border-gold-400 ps-4">
        <CollapsibleText text={memory.text} maxLines={6} />

        <MediaThumbnailGrid items={memory.images} altText={t("memoryPhoto")} />

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

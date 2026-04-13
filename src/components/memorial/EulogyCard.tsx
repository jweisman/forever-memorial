"use client";

import Card from "@/components/ui/Card";
import CollapsibleText from "@/components/ui/CollapsibleText";
import MediaThumbnailGrid from "./MediaThumbnailGrid";
import type { MediaItem } from "./MediaThumbnailGrid";

type EulogyCardProps = {
  eulogy: {
    id: string;
    text: string;
    deliveredBy: string;
    relation: string | null;
    images: MediaItem[];
  };
};

export default function EulogyCard({ eulogy }: EulogyCardProps) {
  return (
    <Card>
      <blockquote className="border-s-4 border-gold-400 ps-4">
        <CollapsibleText text={eulogy.text} maxLines={8} />

        <MediaThumbnailGrid items={eulogy.images} />

        <footer className="mt-4 text-sm">
          <span className="font-medium text-warm-800">
            {eulogy.deliveredBy}
          </span>
          {eulogy.relation && (
            <span className="text-warm-400">
              {" "}
              — {eulogy.relation}
            </span>
          )}
        </footer>
      </blockquote>
    </Card>
  );
}

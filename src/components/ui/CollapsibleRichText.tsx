"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import RichTextContent from "@/components/ui/RichTextContent";

type Props = {
  html: string;
  className?: string;
  /** Collapsed height in px. Default 320 (≈ 20 lines). */
  collapsedHeight?: number;
};

export default function CollapsibleRichText({
  html,
  className = "",
  collapsedHeight = 320,
}: Props) {
  const t = useTranslations("CollapsibleText");
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > collapsedHeight);
    }
  }, [html, collapsedHeight]);

  return (
    <div>
      <div
        className="relative overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded || !needsCollapse ? undefined : collapsedHeight }}
      >
        <div ref={contentRef}>
          <RichTextContent html={html} className={className} />
        </div>
        {/* Gradient fade when collapsed */}
        {!expanded && needsCollapse && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
        )}
      </div>
      {needsCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm font-medium text-accent hover:text-accent-hover"
        >
          {expanded ? t("showLess") : t("readMore")}
        </button>
      )}
    </div>
  );
}

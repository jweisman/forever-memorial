"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type CollapsibleTextProps = {
  text: string;
  maxLines?: number;
  className?: string;
};

export default function CollapsibleText({
  text,
  maxLines = 8,
  className = "",
}: CollapsibleTextProps) {
  const t = useTranslations("CollapsibleText");
  const [expanded, setExpanded] = useState(false);
  const lineCount = text.split("\n").length;
  const charCount = text.length;
  const needsCollapse = lineCount > maxLines || charCount > 500;

  return (
    <div>
      <p
        className={`whitespace-pre-wrap text-sm leading-relaxed text-warm-700 ${
          !expanded && needsCollapse ? `line-clamp-${maxLines}` : ""
        } ${className}`}
        style={
          !expanded && needsCollapse
            ? {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
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

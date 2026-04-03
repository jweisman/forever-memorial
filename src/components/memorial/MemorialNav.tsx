"use client";

import { useState, useEffect, useRef } from "react";

type NavSection = { id: string; label: string; isCta?: boolean };

export default function MemorialNav({ sections }: { sections: NavSection[] }) {
  const [stickyVisible, setStickyVisible] = useState(false);
  const hasBeenVisible = useRef(false);
  const inlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasBeenVisible.current = true;
        }
        // Only show sticky after the inline nav has been seen at least once
        setStickyVisible(hasBeenVisible.current && !entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const ctaSection = sections.find((s) => s.isCta);
  const navItems = sections.filter((s) => !s.isCta);

  const navContent = (
    <>
      {/* Scrollable section links */}
      <div className="flex flex-1 gap-1 overflow-x-auto py-2 scrollbar-hide">
        {navItems.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollTo(section.id)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs text-warm-600 hover:bg-warm-100 hover:text-warm-800"
          >
            {section.label}
          </button>
        ))}
      </div>
      {/* Pinned CTA — always visible */}
      {ctaSection && (
        <div className="flex shrink-0 items-center border-s border-border py-2 ps-2">
          <button
            onClick={() => scrollTo(ctaSection.id)}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            {ctaSection.label}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Inline nav — always visible below the page header on initial load.
          Negative margins break out of the parent article's px-4 sm:px-6 lg:px-8 padding
          so the bar spans full width. */}
      <div
        ref={inlineRef}
        className="-mx-4 mt-8 border-b border-t border-border bg-warm-50 sm:-mx-6 lg:-mx-8"
      >
        <div className="mx-auto flex max-w-3xl items-stretch px-4 sm:px-6 lg:px-8">
          {navContent}
        </div>
      </div>

      {/* Sticky top nav — slides in when inline nav scrolls out of view */}
      <nav
        aria-label="Page sections"
        className={`fixed inset-x-0 top-16 z-40 border-b border-border bg-surface/95 backdrop-blur-sm transition-transform duration-200 ${
          stickyVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-stretch px-4 sm:px-6 lg:px-8">
          {navContent}
        </div>
      </nav>
    </>
  );
}

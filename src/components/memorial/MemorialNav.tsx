"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type NavSection = { id: string; label: string; isCta?: boolean };

function ScrollableNav({ items, onScrollTo }: { items: NavSection[]; onScrollTo: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -150 : 150, behavior: "smooth" });
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute inset-y-0 start-0 z-10 hidden w-7 items-center justify-center bg-gradient-to-r from-warm-50 to-transparent text-warm-500 hover:text-warm-800 sm:flex rtl:bg-gradient-to-l"
          aria-label="Scroll left"
        >
          <svg className="size-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-1 overflow-x-auto py-2 scrollbar-hide"
      >
        {items.map((section) => (
          <button
            key={section.id}
            onClick={() => onScrollTo(section.id)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs text-warm-600 hover:bg-warm-100 hover:text-warm-800"
          >
            {section.label}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute inset-y-0 end-0 z-10 hidden w-7 items-center justify-center bg-gradient-to-l from-warm-50 to-transparent text-warm-500 hover:text-warm-800 sm:flex rtl:bg-gradient-to-r"
          aria-label="Scroll right"
        >
          <svg className="size-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      )}
    </div>
  );
}

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
          setStickyVisible(false);
        } else if (hasBeenVisible.current) {
          // Only show sticky if the user has scrolled DOWN past the inline nav
          // (entry.boundingClientRect.top < 0 means it scrolled above the viewport)
          setStickyVisible(entry.boundingClientRect.top < 0);
        }
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

  const cta = ctaSection && (
    <div className="flex shrink-0 items-center border-s border-border py-2 ps-2">
      <button
        onClick={() => scrollTo(ctaSection.id)}
        className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
      >
        {ctaSection.label}
      </button>
    </div>
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
          <ScrollableNav items={navItems} onScrollTo={scrollTo} />
          {cta}
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
          <ScrollableNav items={navItems} onScrollTo={scrollTo} />
          {cta}
        </div>
      </nav>
    </>
  );
}

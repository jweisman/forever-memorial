"use client";

import { useState, useEffect } from "react";

type NavSection = { id: string; label: string; isCta?: boolean };

export default function MemorialNav({ sections }: { sections: NavSection[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const ctaSection = sections.find((s) => s.isCta);
  const navItems = sections.filter((s) => !s.isCta);

  return (
    <nav
      aria-label="Page sections"
      className={`fixed inset-x-0 top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-stretch px-4 sm:px-6 lg:px-8">
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
      </div>
    </nav>
  );
}

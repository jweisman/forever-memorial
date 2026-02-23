"use client";

import { InputHTMLAttributes, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Suggestion = {
  id: string;
  slug: string;
  name: string;
  placeOfDeath: string | null;
  dateOfDeath: string;
  birthday: string | null;
  pictureUrl: string | null;
};

type SearchBarProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  size?: "sm" | "lg";
};

const sizeClasses = {
  sm: "h-9 text-sm px-3 ps-9",
  lg: "h-12 text-base px-4 ps-11",
};

const iconSizeClasses = {
  sm: "start-2.5 size-4",
  lg: "start-3.5 size-5",
};

function formatYear(date: string | null): string | null {
  if (!date) return null;
  return new Date(date).getFullYear().toString();
}

function formatDateRange(birthday: string | null, dateOfDeath: string): string {
  const deathYear = formatYear(dateOfDeath);
  const birthYear = formatYear(birthday);
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (deathYear) return `d. ${deathYear}`;
  return "";
}

export default function SearchBar({
  size = "sm",
  className = "",
  ...props
}: SearchBarProps) {
  const router = useRouter();
  const t = useTranslations("SearchBar");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const navigateToResult = (slug: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/memorial/${slug}`);
  };

  const handleSubmit = () => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      navigateToResult(suggestions[activeIndex].slug);
    } else if (query.trim().length >= 2) {
      const q = query.trim();
      setOpen(false);
      setSuggestions([]);
      setQuery("");
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        handleSubmit();
        break;
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${iconSizeClasses[size]}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="search"
        className={`w-full rounded-lg border border-border bg-surface text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none ${sizeClasses[size]}`}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="search-suggestions"
        {...props}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute end-3 top-1/2 -translate-y-1/2">
          <div className="size-4 animate-spin rounded-full border-2 border-warm-300 border-t-accent" />
        </div>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                i === activeIndex ? "bg-warm-50" : "hover:bg-warm-50"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigateToResult(s.slug);
              }}
            >
              {/* Thumbnail */}
              <div className="size-8 shrink-0 overflow-hidden rounded bg-warm-200">
                {s.pictureUrl ? (
                  <img
                    src={s.pictureUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-warm-400">
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-warm-800">
                  {s.name}
                </p>
                <p className="truncate text-xs text-muted">
                  {[formatDateRange(s.birthday, s.dateOfDeath), s.placeOfDeath]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}

          {/* "View all results" link */}
          <li
            className="cursor-pointer border-t border-border px-3 py-2 text-center text-xs text-accent hover:bg-warm-50"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
          >
            {t("viewAll")}
          </li>
        </ul>
      )}
    </div>
  );
}

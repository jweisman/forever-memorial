"use client";

import { InputHTMLAttributes } from "react";

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

export default function SearchBar({
  size = "sm",
  className = "",
  ...props
}: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
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
        {...props}
      />
    </div>
  );
}

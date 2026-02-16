"use client";

import { useState, useRef } from "react";
import { validateImageFile, uploadMemorialPicture } from "@/lib/upload";

type MemorialPictureUploaderProps = {
  memorialId: string;
  currentPictureUrl: string | null;
  onUpdate: (newUrl: string | null) => void;
};

export default function MemorialPictureUploader({
  memorialId,
  currentPictureUrl,
  onUpdate,
}: MemorialPictureUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const url = await uploadMemorialPicture(memorialId, file);
      onUpdate(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  }

  async function handleRemove() {
    setError("");
    const res = await fetch(
      `/api/memorials/${memorialId}/memorial-picture`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate(null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="group relative size-28 cursor-pointer overflow-hidden rounded-full bg-warm-200"
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        aria-label="Upload memorial picture"
      >
        {currentPictureUrl ? (
          <img
            src={currentPictureUrl}
            alt="Memorial picture"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <svg
              className="size-14 text-warm-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs font-medium text-white">
            {uploading ? "Uploading..." : "Change photo"}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
        className="hidden"
      />

      {currentPictureUrl && !uploading && (
        <button
          onClick={handleRemove}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Remove photo
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

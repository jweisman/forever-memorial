"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  validateImageFile,
  validateVideoFile,
  isVideoFile,
  uploadImage,
  uploadVideo,
} from "@/lib/upload";

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
};

type ImageUploaderProps = {
  memorialId: string;
  albumId?: string;
  onUploadComplete: (image: ImageRecord) => void;
  disabled?: boolean;
};

export default function ImageUploader({
  memorialId,
  albumId,
  onUploadComplete,
  disabled,
}: ImageUploaderProps) {
  const t = useTranslations("EditMemorial");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);

    for (const file of Array.from(files)) {
      const validationError = isVideoFile(file)
        ? validateVideoFile(file)
        : validateImageFile(file);
      if (validationError) {
        setError(validationError);
        setUploading(false);
        return;
      }

      try {
        const image = isVideoFile(file)
          ? await uploadVideo(memorialId, file, { albumId })
          : await uploadImage(memorialId, file, { albumId });
        onUploadComplete(image);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!disabled && !uploading) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled && !uploading) setDragOver(true);
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-warm-200 bg-warm-50 opacity-50"
            : dragOver
              ? "border-accent bg-accent/5"
              : "border-warm-300 hover:border-accent hover:bg-warm-50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !uploading) inputRef.current?.click();
          }
        }}
        aria-label={t("uploadImages")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <p className="text-sm text-muted">{t("uploadingImages")}</p>
        ) : disabled ? (
          <p className="text-sm text-muted">{t("imageLimitReached")}</p>
        ) : (
          <>
            <svg
              className="mx-auto size-8 text-warm-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
            <p className="mt-2 text-sm text-muted">
              {t("dropOrClick")}
            </p>
            <p className="mt-1 text-xs text-warm-400">
              {t("imageFormats")}
            </p>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

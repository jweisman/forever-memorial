"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  validateImageFile,
  validateVideoFile,
  isVideoFile,
  uploadImage,
  uploadVideo,
} from "@/lib/upload";
import UploadProgressBar from "@/components/ui/UploadProgressBar";

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

type UploadState = {
  fileName: string;
  progress: number;
};

export default function ImageUploader({
  memorialId,
  albumId,
  onUploadComplete,
  disabled,
}: ImageUploaderProps) {
  const t = useTranslations("EditMemorial");
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setUploads([]);
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);

    const fileList = Array.from(files);

    // Validate all files first
    for (const file of fileList) {
      const validationError = isVideoFile(file)
        ? validateVideoFile(file)
        : validateImageFile(file);
      if (validationError) {
        setError(validationError);
        setUploading(false);
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Initialize upload state for all files
    setUploads(fileList.map((f) => ({ fileName: f.name, progress: 0 })));

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      try {
        const image = isVideoFile(file)
          ? await uploadVideo(memorialId, file, {
              albumId,
              onProgress: (p) => {
                setUploads((prev) =>
                  prev.map((u, idx) => (idx === i ? { ...u, progress: p } : u))
                );
              },
              signal: controller.signal,
            })
          : await uploadImage(memorialId, file, {
              albumId,
              onProgress: (p) => {
                setUploads((prev) =>
                  prev.map((u, idx) => (idx === i ? { ...u, progress: p } : u))
                );
              },
              signal: controller.signal,
            });
        onUploadComplete(image);

        // Mark this file as complete
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, progress: 1 } : u))
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — already handled
          return;
        }
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
        setUploads([]);
        return;
      }
    }

    abortRef.current = null;
    setUploading(false);
    setUploads([]);
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
            : uploading
              ? "border-accent/50 bg-accent/5"
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
          <div className="space-y-3 px-2">
            {uploads.map((upload, i) => (
              <UploadProgressBar
                key={i}
                progress={upload.progress}
                label={upload.fileName}
                onCancel={cancelUpload}
                cancelLabel={t("cancel")}
              />
            ))}
          </div>
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

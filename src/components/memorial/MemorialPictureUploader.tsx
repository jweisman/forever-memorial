"use client";

import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { validateImageFile, uploadMemorialPicture, uploadMemorialPictureBlob } from "@/lib/upload";
import { cropAndResizeImage } from "@/lib/image-resize";
import Button from "@/components/ui/Button";

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
  const t = useTranslations("EditMemorial");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleFile(file: File) {
    setError("");
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // GIFs skip crop (canvas loses animation)
    if (file.type === "image/gif") {
      setUploading(true);
      try {
        const url = await uploadMemorialPicture(memorialId, file);
        onUpdate(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading(false);
      return;
    }

    // Show crop UI for all other image types
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropSrc(URL.createObjectURL(file));
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return;
    setUploading(true);
    setError("");
    try {
      const blob = await cropAndResizeImage(cropSrc, croppedAreaPixels, 800, 600, 0.8);
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      const url = await uploadMemorialPictureBlob(memorialId, blob);
      onUpdate(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
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
    <>
      <div className="flex flex-col items-center gap-3">
        <div
          className="group relative aspect-[4/3] w-full max-w-xs cursor-pointer overflow-hidden rounded-xl bg-warm-200"
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!uploading) inputRef.current?.click();
            }
          }}
          aria-label={t("uploadLabel")}
        >
          {currentPictureUrl ? (
            <img
              src={currentPictureUrl}
              alt={t("memorialPicture")}
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
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-xs font-medium text-white">
              {uploading ? t("uploading") : t("changePhoto")}
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
            {t("removePhoto")}
          </button>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="font-heading text-base font-semibold text-warm-800">
              {t("cropTitle")}
            </h3>

            {/* Cropper — needs explicit height */}
            <div className="relative h-64 w-full overflow-hidden rounded-lg">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-warm-500">{t("cropZoom")}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCropConfirm}
                disabled={uploading}
              >
                {uploading ? t("uploading") : t("cropConfirm")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCropCancel}
                disabled={uploading}
              >
                {t("cropCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import ImageUploader from "./ImageUploader";
import ScrollableRow from "./ScrollableRow";

type ImageRecord = {
  id: string;
  s3Key: string;
  albumId: string;
  caption: string | null;
  order: number;
  thumbUrl: string;
  url: string;
};

type AlbumSectionProps = {
  album: { id: string; name: string };
  images: ImageRecord[];
  memorialId: string;
  totalImageCount: number;
  onImagesChange: () => void;
  // Album drag props
  albumDraggable?: boolean;
  onAlbumDragStart?: (e: React.DragEvent) => void;
  onAlbumDragOver?: (e: React.DragEvent) => void;
  onAlbumDragEnd?: () => void;
  isAlbumDragTarget?: boolean;
};

export default function AlbumSection({
  album,
  images,
  memorialId,
  totalImageCount,
  onImagesChange,
  albumDraggable,
  onAlbumDragStart,
  onAlbumDragOver,
  onAlbumDragEnd,
  isAlbumDragTarget,
}: AlbumSectionProps) {
  const t = useTranslations("EditMemorial");
  const [editingName, setEditingName] = useState(false);
  const [albumName, setAlbumName] = useState(album.name);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  async function handleRenameAlbum() {
    if (!albumName.trim()) return;
    await fetch(`/api/memorials/${memorialId}/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: albumName.trim() }),
    });
    setEditingName(false);
    onImagesChange();
  }

  async function handleDeleteAlbum() {
    if (!confirm(t("deleteAlbumConfirm", { name: album.name }))) return;
    await fetch(`/api/memorials/${memorialId}/albums/${album.id}`, {
      method: "DELETE",
    });
    onImagesChange();
  }

  async function handleDeleteImage(imageId: string) {
    await fetch(`/api/memorials/${memorialId}/images/${imageId}`, {
      method: "DELETE",
    });
    onImagesChange();
  }

  async function handleSaveCaption(imageId: string) {
    await fetch(`/api/memorials/${memorialId}/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: captionValue }),
    });
    setEditingCaptionId(null);
    onImagesChange();
  }

  function handleImageDragStart(e: React.DragEvent, index: number) {
    e.stopPropagation();
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "image");
  }

  function handleImageDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  async function handleImageDragEnd() {
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDragIndex(null);
    setDropIndex(null);

    await fetch(`/api/memorials/${memorialId}/images/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: reordered.map((img) => img.id) }),
    });
    onImagesChange();
  }

  return (
    <div
      className={`rounded-lg border border-border p-4 transition-colors ${
        isAlbumDragTarget ? "border-accent bg-accent/5" : ""
      }`}
      draggable={albumDraggable}
      onDragStart={onAlbumDragStart}
      onDragOver={onAlbumDragOver}
      onDragEnd={onAlbumDragEnd}
    >
      {/* Album header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {albumDraggable && (
            <span
              className="cursor-grab text-warm-300 active:cursor-grabbing"
              title={t("dragToReorder")}
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </span>
          )}
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-sm text-warm-800"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameAlbum();
                  if (e.key === "Escape") {
                    setAlbumName(album.name);
                    setEditingName(false);
                  }
                }}
              />
              <Button variant="ghost" size="sm" onClick={handleRenameAlbum}>
                {t("save")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAlbumName(album.name);
                  setEditingName(false);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <h3 className="font-heading text-base font-semibold text-warm-800">
              {album.name}
            </h3>
          )}
        </div>
        <div className="flex gap-2">
          {!editingName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingName(true)}
            >
              {t("rename")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={handleDeleteAlbum}
          >
            {t("delete")}
          </Button>
        </div>
      </div>

      {/* Image grid — 2 rows with scroll arrows */}
      {images.length > 0 && (
        <>
          {images.length > 1 && (
            <p className="mt-2 text-xs text-warm-400">
              {t("dragImagesHint")}
            </p>
          )}
          <div className="mt-2">
            <ScrollableRow>
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={(e) => handleImageDragStart(e, index)}
                  onDragOver={(e) => handleImageDragOver(e, index)}
                  onDragEnd={handleImageDragEnd}
                  className={`group relative size-32 shrink-0 overflow-hidden rounded-lg bg-warm-100 ${
                    dragIndex === index ? "opacity-50" : ""
                  } ${dropIndex === index ? "ring-2 ring-accent" : ""}`}
                >
                  <img
                    src={image.thumbUrl}
                    alt={image.caption || t("galleryImage")}
                    className="size-full cursor-grab object-cover active:cursor-grabbing"
                    loading="lazy"
                    draggable={false}
                  />

                  {/* Actions overlay */}
                  <div className="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/50 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setEditingCaptionId(image.id);
                        setCaptionValue(image.caption || "");
                      }}
                      className="rounded bg-black/50 px-1.5 py-0.5 text-xs text-white hover:bg-black/70"
                    >
                      {t("caption")}
                    </button>
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="rounded bg-red-600/80 px-1.5 py-0.5 text-xs text-white hover:bg-red-700"
                    >
                      {t("delete")}
                    </button>
                  </div>

                  {/* Caption display/edit */}
                  {editingCaptionId === image.id ? (
                    <div className="absolute inset-x-0 bottom-0 bg-white p-2">
                      <input
                        type="text"
                        value={captionValue}
                        onChange={(e) => setCaptionValue(e.target.value)}
                        className="w-full rounded border border-border px-2 py-1 text-xs"
                        placeholder={t("captionPlaceholder")}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCaption(image.id);
                          if (e.key === "Escape") setEditingCaptionId(null);
                        }}
                      />
                      <div className="mt-1 flex gap-1">
                        <button
                          onClick={() => handleSaveCaption(image.id)}
                          className="text-xs text-accent hover:text-accent-hover"
                        >
                          {t("save")}
                        </button>
                        <button
                          onClick={() => setEditingCaptionId(null)}
                          className="text-xs text-warm-400 hover:text-warm-600"
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    image.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="truncate text-xs text-white">
                          {image.caption}
                        </p>
                      </div>
                    )
                  )}
                </div>
              ))}
            </ScrollableRow>
          </div>
        </>
      )}

      {/* Upload zone */}
      <div className="mt-4">
        <ImageUploader
          memorialId={memorialId}
          albumId={album.id}
          onUploadComplete={() => onImagesChange()}
          disabled={totalImageCount >= 100}
        />
      </div>
    </div>
  );
}

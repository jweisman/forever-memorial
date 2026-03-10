"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import {
  isVideoFile,
  validateImageFile,
  validateVideoFile,
  uploadMemoryImage,
  uploadMemoryVideo,
} from "@/lib/upload";

function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 10000);

    video.addEventListener("loadedmetadata", () => { video.currentTime = 0.1; });

    video.addEventListener("seeked", () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 160;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); reject(new Error("no ctx")); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) { cleanup(); reject(e); }
    });

    video.addEventListener("error", () => { clearTimeout(timer); cleanup(); reject(new Error("load error")); });
    video.load();
  });
}

type MemoryImage = {
  id: string;
  thumbUrl: string;
  url: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO";
};

type MySubmissionCardProps = {
  memory: {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    status: string;
    returnMessage: string | null;
    createdAt: string;
    images: MemoryImage[];
    memorial: { id: string; name: string; slug: string };
  };
  onChanged: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MySubmissionCard({
  memory,
  onChanged,
}: MySubmissionCardProps) {
  const t = useTranslations("MySubmission");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(memory.name);
  const [relation, setRelation] = useState(memory.relation || "");
  const [text, setText] = useState(memory.text);
  const [withholdName, setWithholdName] = useState(memory.withholdName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [existingImages, setExistingImages] = useState<MemoryImage[]>(memory.images);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [videoThumbnails, setVideoThumbnails] = useState<Map<File, string>>(new Map());
  const [mediaError, setMediaError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusLabels: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: t("pendingReview"),
      className: "bg-amber-100 text-amber-700",
    },
    ACCEPTED: {
      label: t("accepted"),
      className: "bg-green-100 text-green-700",
    },
    RETURNED: {
      label: t("returned"),
      className: "bg-blue-100 text-blue-700",
    },
    IGNORED: {
      label: t("underReview"),
      className: "bg-warm-100 text-warm-500",
    },
  };

  const status = statusLabels[memory.status] ?? statusLabels.PENDING;

  function startEditing() {
    setName(memory.name);
    setRelation(memory.relation || "");
    setText(memory.text);
    setWithholdName(memory.withholdName);
    setExistingImages(memory.images);
    setPendingRemovals([]);
    setNewFiles([]);
    setMediaError("");
    setEditing(true);
  }

  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setPendingRemovals((prev) => [...prev, id]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const totalCount = existingImages.length + newFiles.length + selected.length;
    if (totalCount > 5) {
      setMediaError(t("maxPhotos"));
      return;
    }
    for (const file of selected) {
      const validationError = isVideoFile(file)
        ? validateVideoFile(file)
        : validateImageFile(file);
      if (validationError) {
        setMediaError(validationError);
        return;
      }
    }
    setMediaError("");
    setNewFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of selected) {
      if (isVideoFile(file)) {
        generateVideoThumbnail(file)
          .then((thumbnail) =>
            setVideoThumbnails((prev) => new Map(prev).set(file, thumbnail))
          )
          .catch(() => {/* fall back to <video> element */});
      }
    }
  }

  async function handleSaveAndResubmit() {
    if (!name.trim() || !text.trim()) return;
    setSaving(true);

    for (const imageId of pendingRemovals) {
      await fetch(
        `/api/memorials/${memory.memorialId}/memories/${memory.id}/images/${imageId}`,
        { method: "DELETE" }
      );
    }

    for (const file of newFiles) {
      if (isVideoFile(file)) {
        await uploadMemoryVideo(memory.memorialId, memory.id, file);
      } else {
        await uploadMemoryImage(memory.memorialId, memory.id, file);
      }
    }

    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relation: relation.trim() || null,
          text: text.trim(),
          withholdName,
        }),
      }
    );
    if (res.ok) {
      setEditing(false);
      onChanged();
    }
    setSaving(false);
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onChanged();
    }
  }

  const totalMediaCount = existingImages.length + newFiles.length;

  if (editing) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/memorial/${memory.memorial.slug}`}
            className="text-sm font-medium text-accent hover:text-accent-hover"
          >
            {memory.memorial.name}
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {memory.returnMessage && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-700">
              {t("ownerFeedback")}
            </p>
            <p className="mt-1 text-sm text-blue-600">
              {memory.returnMessage}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("yourName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={withholdName}
              onChange={(e) => setWithholdName(e.target.checked)}
              className="rounded border-warm-300 text-accent focus:ring-accent"
            />
            <span className="text-sm text-warm-600">{t("anonymous")}</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("relation")}
            </label>
            <input
              type="text"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className={inputClass}
              placeholder={t("relationPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("yourMemory")}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className={inputClass}
            />
          </div>

          {/* Media management */}
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("photosLabel")}
            </label>
            {(existingImages.length > 0 || newFiles.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {existingImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative size-20 overflow-hidden rounded-lg bg-warm-100"
                  >
                    {img.mediaType === "VIDEO" ? (
                      <video
                        src={img.thumbUrl}
                        className="size-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={img.thumbUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {newFiles.map((file, index) => (
                  <div
                    key={`new-${index}`}
                    className="relative size-20 overflow-hidden rounded-lg bg-warm-100"
                  >
                    {isVideoFile(file) ? (
                      videoThumbnails.has(file) ? (
                        <img
                          src={videoThumbnails.get(file)}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <video
                          src={URL.createObjectURL(file)}
                          className="size-full object-cover"
                          muted
                          preload="metadata"
                        />
                      )
                    ) : (
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewFiles((prev) => prev.filter((_, i) => i !== index));
                        setVideoThumbnails((prev) => { const next = new Map(prev); next.delete(file); return next; });
                      }}
                      className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {totalMediaCount < 5 && (
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-warm-300 px-4 py-2 text-sm text-warm-500 hover:border-accent hover:text-accent"
                >
                  {t("addPhotos")}
                </button>
              </div>
            )}
            {mediaError && (
              <p className="mt-1 text-sm text-red-600">{mediaError}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAndResubmit}
              disabled={saving || !name.trim() || !text.trim()}
            >
              {saving ? t("saving") : t("saveResubmit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/memorial/${memory.memorial.slug}`}
          className="text-sm font-medium text-accent hover:text-accent-hover"
        >
          {memory.memorial.name}
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
          <span className="text-xs text-warm-300">
            {formatDate(memory.createdAt, locale)}
          </span>
        </div>
      </div>

      {memory.status === "RETURNED" && memory.returnMessage && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700">
            {t("ownerFeedback")}
          </p>
          <p className="mt-1 text-sm text-blue-600">{memory.returnMessage}</p>
        </div>
      )}

      <p className="mt-3 line-clamp-3 text-sm text-warm-700">{memory.text}</p>

      {memory.images.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {memory.images.map((img) => (
            <div
              key={img.id}
              className="relative size-10 overflow-hidden rounded bg-warm-100"
            >
              {img.mediaType === "VIDEO" ? (
                <video
                  src={img.thumbUrl}
                  className="size-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img src={img.thumbUrl} alt="" className="size-full object-cover" />
              )}
              {img.mediaType === "VIDEO" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/50 p-1">
                    <svg className="size-3 text-white" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 2l10 6-10 6z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {memory.status === "RETURNED" && (
          <Button variant="primary" size="sm" onClick={startEditing}>
            {t("editResubmit")}
          </Button>
        )}
        {(memory.status === "PENDING" || memory.status === "ACCEPTED" || memory.status === "RETURNED") &&
          (confirmDelete ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={handleDelete}
              >
                {t("confirmDelete")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              {t("delete")}
            </Button>
          ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import {
  validateImageFile,
  validateVideoFile,
  isVideoFile,
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

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = 0.1;
    });

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
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    video.addEventListener("error", () => { clearTimeout(timer); cleanup(); reject(new Error("load error")); });
    video.load();
  });
}

type MemorySubmissionFormProps = {
  memorialId: string;
  onSubmitted?: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

export default function MemorySubmissionForm({
  memorialId,
  onSubmitted,
}: MemorySubmissionFormProps) {
  const { data: session } = useSession();
  const t = useTranslations("MemorySubmission");
  const [name, setName] = useState(session?.user?.name || "");
  const [withholdName, setWithholdName] = useState(false);
  const [relation, setRelation] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [videoThumbnails, setVideoThumbnails] = useState<Map<File, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/memorials/${memorialId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          withholdName,
          relation: relation.trim() || undefined,
          text: text.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit memory");
      }

      const memory = await res.json();

      for (const file of files) {
        if (isVideoFile(file)) {
          await uploadMemoryVideo(memorialId, memory.id, file);
        } else {
          await uploadMemoryImage(memorialId, memory.id, file);
        }
      }

      setSuccess(true);
      setName(session?.user?.name || "");
      setWithholdName(false);
      setRelation("");
      setText("");
      setFiles([]);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const totalCount = files.length + selected.length;
    if (totalCount > 5) {
      setError(t("maxPhotos"));
      return;
    }

    for (const file of selected) {
      const validationError = isVideoFile(file)
        ? validateVideoFile(file)
        : validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError("");
    setFiles((prev) => [...prev, ...selected]);
    if (inputRef.current) inputRef.current.value = "";

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

  function removeFile(index: number) {
    const file = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setVideoThumbnails((prev) => {
      const next = new Map(prev);
      next.delete(file);
      return next;
    });
  }

  if (success) {
    return (
      <div className="rounded-lg border border-gold-400 bg-gold-300/10 p-6 text-center">
        <p className="font-heading text-base font-semibold text-warm-800">
          {t("thankYou")}
        </p>
        <p className="mt-2 text-sm text-warm-600">
          {t("awaitingReview")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setSuccess(false)}
        >
          {t("shareAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="memory-name"
          className="block text-sm font-medium text-warm-700"
        >
          {t("nameLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          id="memory-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder={t("namePlaceholder")}
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={withholdName}
          onChange={(e) => setWithholdName(e.target.checked)}
          className="rounded border-warm-300 text-accent focus:ring-accent"
        />
        <span className="text-sm text-warm-600">
          {t("anonymous")}
        </span>
      </label>

      <div>
        <label
          htmlFor="memory-relation"
          className="block text-sm font-medium text-warm-700"
        >
          {t("relationLabel")}
        </label>
        <input
          id="memory-relation"
          type="text"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className={inputClass}
          placeholder={t("relationPlaceholder")}
        />
      </div>

      <div>
        <label
          htmlFor="memory-text"
          className="block text-sm font-medium text-warm-700"
        >
          {t("memoryLabel")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="memory-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={5}
          className={inputClass}
          placeholder={t("memoryPlaceholder")}
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-warm-700">
          {t("photosLabel")}
        </label>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
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
                  onClick={() => removeFile(index)}
                  className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < 5 && (
          <div className="mt-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-warm-300 px-4 py-2 text-sm text-warm-500 hover:border-accent hover:text-accent"
            >
              {t("addPhotos")}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" variant="primary" size="sm" disabled={submitting}>
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

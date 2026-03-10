"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

type MemoryImage = { id: string; thumbUrl: string; url: string; caption: string | null; mediaType: "IMAGE" | "VIDEO" };

type MemoryReviewCardProps = {
  memory: {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    status: string;
    createdAt: string;
    images: MemoryImage[];
  };
  onReviewed: () => void;
};

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-warm-800 placeholder-warm-400 focus:border-accent focus:outline-none";

export default function MemoryReviewCard({
  memory,
  onReviewed,
}: MemoryReviewCardProps) {
  const t = useTranslations("MemoryReview");
  const locale = useLocale();

  // Local display values — updated after a successful edit without a full list refresh
  const [displayName, setDisplayName] = useState(memory.name);
  const [displayWithholdName, setDisplayWithholdName] = useState(memory.withholdName);
  const [displayRelation, setDisplayRelation] = useState(memory.relation);
  const [displayText, setDisplayText] = useState(memory.text);
  const [displayImages, setDisplayImages] = useState<MemoryImage[]>(memory.images);

  // Review actions state
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");
  const [acting, setActing] = useState(false);

  // Edit form state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState(memory.name);
  const [editWithholdName, setEditWithholdName] = useState(memory.withholdName);
  const [editRelation, setEditRelation] = useState(memory.relation ?? "");
  const [editText, setEditText] = useState(memory.text);
  const [editImages, setEditImages] = useState<MemoryImage[]>(memory.images);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setEditName(displayName);
    setEditWithholdName(displayWithholdName);
    setEditRelation(displayRelation ?? "");
    setEditText(displayText);
    setEditImages(displayImages);
    setPendingRemovals([]);
    setShowEditForm(true);
  }

  function removeEditImage(imageId: string) {
    setEditImages((prev) => prev.filter((img) => img.id !== imageId));
    setPendingRemovals((prev) => [...prev, imageId]);
  }

  async function handleSave() {
    if (!editName.trim() || !editText.trim()) return;
    setSaving(true);

    for (const imageId of pendingRemovals) {
      await fetch(
        `/api/memorials/${memory.memorialId}/memories/${memory.id}/images/${imageId}`,
        { method: "DELETE" }
      );
    }

    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          withholdName: editWithholdName,
          relation: editRelation.trim() || null,
          text: editText.trim(),
        }),
      }
    );
    if (res.ok) {
      setDisplayName(editName.trim());
      setDisplayWithholdName(editWithholdName);
      setDisplayRelation(editRelation.trim() || null);
      setDisplayText(editText.trim());
      setDisplayImages(editImages);
      setPendingRemovals([]);
      setShowEditForm(false);
    }
    setSaving(false);
  }

  async function handleAction(action: "accept" | "ignore" | "return") {
    if (action === "return" && !returnMessage.trim()) return;
    setActing(true);

    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "return" && { returnMessage: returnMessage.trim() }),
        }),
      }
    );

    if (res.ok) {
      onReviewed();
    }
    setActing(false);
  }

  return (
    <div id={`memory-${memory.id}`} className="rounded-lg border border-border p-4">
      {showEditForm ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("nameLabel")}
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-warm-600">
            <input
              type="checkbox"
              checked={editWithholdName}
              onChange={(e) => setEditWithholdName(e.target.checked)}
              className="rounded border-warm-300 text-accent focus:ring-accent"
            />
            {t("anonymous")}
          </label>
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("relationLabel")}
            </label>
            <input
              type="text"
              value={editRelation}
              onChange={(e) => setEditRelation(e.target.value)}
              placeholder={t("relationPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("memoryLabel")}
            </label>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className={inputClass}
            />
          </div>
          {editImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-warm-700">
                {t("memoryPhoto")}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {editImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-100"
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
                        alt={img.caption || ""}
                        className="size-full object-cover"
                      />
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
                    <button
                      type="button"
                      onClick={() => removeEditImage(img.id)}
                      className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !editName.trim() || !editText.trim()}
            >
              {t("save")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditForm(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-warm-800">
                {displayName}
                {displayWithholdName && (
                  <span className="ms-2 text-xs text-warm-400">
                    {t("wantsAnonymous")}
                  </span>
                )}
              </p>
              {displayRelation && (
                <p className="text-xs text-warm-400">{displayRelation}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {memory.status === "IGNORED" && (
                <span className="rounded bg-warm-100 px-2 py-0.5 text-xs text-warm-500">
                  {t("ignored")}
                </span>
              )}
              <span className="text-xs text-warm-300">
                {formatDate(memory.createdAt, locale)}
              </span>
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-warm-700">
            {displayText}
          </p>

          {displayImages.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {displayImages.map((img) => (
                <div
                  key={img.id}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-warm-100"
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
                      alt={img.caption || t("memoryPhoto")}
                      className="size-full object-cover"
                      loading="lazy"
                    />
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

          {/* Return message form */}
          {showReturnForm && (
            <div className="mt-3">
              <textarea
                value={returnMessage}
                onChange={(e) => setReturnMessage(e.target.value)}
                placeholder={t("returnPlaceholder")}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-warm-800 placeholder-warm-400 focus:border-accent focus:outline-none"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction("return")}
                  disabled={acting || !returnMessage.trim()}
                >
                  {t("sendBack")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReturnForm(false);
                    setReturnMessage("");
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showReturnForm && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAction("accept")}
                disabled={acting}
              >
                {t("accept")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction("ignore")}
                disabled={acting}
              >
                {t("ignore")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-600 hover:text-amber-700"
                onClick={() => setShowReturnForm(true)}
                disabled={acting}
              >
                {t("return")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEdit}
                disabled={acting}
              >
                {t("edit")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

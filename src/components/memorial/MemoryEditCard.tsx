"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import VideoThumbnail from "./VideoThumbnail";

type MemoryEditCardProps = {
  memory: {
    id: string;
    memorialId: string;
    name: string;
    withholdName: boolean;
    relation: string | null;
    text: string;
    images: { id: string; thumbUrl: string; url: string; caption: string | null; mediaType: "IMAGE" | "VIDEO" }[];
  };
  onUpdated: () => void;
  onDeleted: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

export default function MemoryEditCard({
  memory,
  onUpdated,
  onDeleted,
}: MemoryEditCardProps) {
  const t = useTranslations("EditMemorial");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(memory.name);
  const [relation, setRelation] = useState(memory.relation || "");
  const [text, setText] = useState(memory.text);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relation: relation.trim() || null,
          text: text.trim(),
        }),
      }
    );
    if (res.ok) {
      setEditing(false);
      onUpdated();
    }
    setSaving(false);
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onDeleted();
    }
  }

  async function handleDeleteImage(imageId: string) {
    const res = await fetch(
      `/api/memorials/${memory.memorialId}/memories/${memory.id}/images/${imageId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdated();
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-warm-700">
              {t("name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
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
              {t("memoryText")}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className={inputClass}
            />
          </div>

          {memory.images.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-warm-700">
                {t("photos")}
              </label>
              <div className="mt-2 flex gap-2">
                {memory.images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative size-16 overflow-hidden rounded-lg bg-warm-100"
                  >
                    {img.mediaType === "VIDEO" ? (
                      <VideoThumbnail
                        src={img.thumbUrl}
                        className="size-full object-cover"
                      />
                    ) : (
                      <img
                        src={img.thumbUrl}
                        alt={img.caption || t("memoryPhoto")}
                        className="size-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {t("delete")}
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
              disabled={saving || !name.trim() || !text.trim()}
            >
              {saving ? t("saving") : t("save")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(memory.name);
                setRelation(memory.relation || "");
                setText(memory.text);
                setEditing(false);
              }}
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
      <p className="line-clamp-3 text-sm text-warm-700">{memory.text}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium text-warm-800">{memory.name}</span>
        {memory.relation && (
          <span className="text-warm-400"> — {memory.relation}</span>
        )}
      </p>

      {memory.images.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {memory.images.map((img) => (
            <div
              key={img.id}
              className="relative size-10 overflow-hidden rounded bg-warm-100"
            >
              {img.mediaType === "VIDEO" ? (
                <VideoThumbnail
                  src={img.thumbUrl}
                  className="size-full object-cover"
                />
              ) : (
                <img
                  src={img.url}
                  alt=""
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
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
        {confirmDelete ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={handleDelete}
            >
              {t("confirm")}
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
        )}
      </div>
    </div>
  );
}

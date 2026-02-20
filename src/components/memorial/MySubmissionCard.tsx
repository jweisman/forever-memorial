"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

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
    images: { id: string; thumbUrl: string; url: string; caption: string | null }[];
    memorial: { id: string; name: string; slug: string };
  };
  onChanged: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pending review",
    className: "bg-amber-100 text-amber-700",
  },
  ACCEPTED: {
    label: "Accepted",
    className: "bg-green-100 text-green-700",
  },
  RETURNED: {
    label: "Returned",
    className: "bg-red-100 text-red-700",
  },
  IGNORED: {
    label: "Under review",
    className: "bg-warm-100 text-warm-500",
  },
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MySubmissionCard({
  memory,
  onChanged,
}: MySubmissionCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(memory.name);
  const [relation, setRelation] = useState(memory.relation || "");
  const [text, setText] = useState(memory.text);
  const [withholdName, setWithholdName] = useState(memory.withholdName);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = statusLabels[memory.status] ?? statusLabels.PENDING;

  async function handleSaveAndResubmit() {
    if (!name.trim() || !text.trim()) return;
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
          <div className="mb-4 rounded-lg bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700">
              Feedback from page owner:
            </p>
            <p className="mt-1 text-sm text-red-600">
              {memory.returnMessage}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-warm-700">
              Your name
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
            <span className="text-sm text-warm-600">Display as anonymous</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-warm-700">
              Relation
            </label>
            <input
              type="text"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className={inputClass}
              placeholder="e.g. Friend, Colleague"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700">
              Your memory
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAndResubmit}
              disabled={saving || !name.trim() || !text.trim()}
            >
              {saving ? "Saving..." : "Save & Resubmit"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(memory.name);
                setRelation(memory.relation || "");
                setText(memory.text);
                setWithholdName(memory.withholdName);
                setEditing(false);
              }}
            >
              Cancel
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
            {formatDate(memory.createdAt)}
          </span>
        </div>
      </div>

      {memory.status === "RETURNED" && memory.returnMessage && (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">
            Feedback from page owner:
          </p>
          <p className="mt-1 text-sm text-red-600">{memory.returnMessage}</p>
        </div>
      )}

      <p className="mt-3 line-clamp-3 text-sm text-warm-700">{memory.text}</p>

      {memory.images.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {memory.images.map((img) => (
            <div
              key={img.id}
              className="size-10 overflow-hidden rounded bg-warm-100"
            >
              <img src={img.thumbUrl} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {memory.status === "RETURNED" && (
          <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
            Edit & Resubmit
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
                Confirm delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          ))}
      </div>
    </div>
  );
}

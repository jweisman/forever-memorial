"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type EulogyData = {
  text: string;
  deliveredBy: string;
  relation: string;
};

type EulogyFormProps = {
  initialData?: EulogyData;
  onSave: (data: EulogyData) => Promise<void>;
  onCancel: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

export default function EulogyForm({
  initialData,
  onSave,
  onCancel,
}: EulogyFormProps) {
  const [text, setText] = useState(initialData?.text ?? "");
  const [deliveredBy, setDeliveredBy] = useState(
    initialData?.deliveredBy ?? ""
  );
  const [relation, setRelation] = useState(initialData?.relation ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !deliveredBy.trim()) return;
    setSaving(true);
    await onSave({ text: text.trim(), deliveredBy: deliveredBy.trim(), relation: relation.trim() });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="eulogy-text"
          className="block text-sm font-medium text-warm-700"
        >
          Eulogy text
        </label>
        <textarea
          id="eulogy-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={6}
          className={inputClass}
          placeholder="Enter the eulogy text..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="eulogy-delivered-by"
            className="block text-sm font-medium text-warm-700"
          >
            Delivered by
          </label>
          <input
            id="eulogy-delivered-by"
            type="text"
            value={deliveredBy}
            onChange={(e) => setDeliveredBy(e.target.value)}
            required
            className={inputClass}
            placeholder="Name of speaker"
          />
        </div>
        <div>
          <label
            htmlFor="eulogy-relation"
            className="block text-sm font-medium text-warm-700"
          >
            Relation (optional)
          </label>
          <input
            id="eulogy-relation"
            type="text"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className={inputClass}
            placeholder="e.g. Son, Friend, Rabbi"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "Saving..." : initialData ? "Update Eulogy" : "Add Eulogy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

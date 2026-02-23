"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Eulogy");
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
          {t("textLabel")}
        </label>
        <textarea
          id="eulogy-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={6}
          className={inputClass}
          placeholder={t("textPlaceholder")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="eulogy-delivered-by"
            className="block text-sm font-medium text-warm-700"
          >
            {t("deliveredByLabel")}
          </label>
          <input
            id="eulogy-delivered-by"
            type="text"
            value={deliveredBy}
            onChange={(e) => setDeliveredBy(e.target.value)}
            required
            className={inputClass}
            placeholder={t("deliveredByPlaceholder")}
          />
        </div>
        <div>
          <label
            htmlFor="eulogy-relation"
            className="block text-sm font-medium text-warm-700"
          >
            {t("relationLabel")}
          </label>
          <input
            id="eulogy-relation"
            type="text"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className={inputClass}
            placeholder={t("relationPlaceholder")}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? t("saving") : initialData ? t("update") : t("add")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

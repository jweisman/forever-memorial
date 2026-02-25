"use client";

import { useRef, useState } from "react";
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
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImportError("");
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/eulogies/extract-text", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || t("importError"));
      } else {
        setText(data.text);
      }
    } catch {
      setImportError(t("importError"));
    }
    setImporting(false);
  }

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
        <div className="flex items-center justify-between">
          <label
            htmlFor="eulogy-text"
            className="block text-sm font-medium text-warm-700"
          >
            {t("textLabel")}
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || saving}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {importing ? t("importing") : t("importFromFile")}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileImport}
          className="hidden"
        />
        {importError && (
          <p className="mt-1 text-xs text-red-600">{importError}</p>
        )}
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

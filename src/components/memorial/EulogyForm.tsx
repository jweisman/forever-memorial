"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import VideoThumbnail from "./VideoThumbnail";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import {
  validateImageFile,
  validateVideoFile,
  isVideoFile,
} from "@/lib/upload";

type EulogyData = {
  text: string;
  deliveredBy: string;
  relation: string;
};

type EulogyFormProps = {
  initialData?: EulogyData;
  onSave: (data: EulogyData, files: File[]) => Promise<void>;
  onCancel: () => void;
  uploadProgress?: { fileName: string; progress: number }[];
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

export default function EulogyForm({
  initialData,
  onSave,
  onCancel,
  uploadProgress,
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
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (docFileInputRef.current) docFileInputRef.current.value = "";
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

  function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const totalCount = files.length + selected.length;
    if (totalCount > 5) {
      setFileError(t("maxMedia"));
      return;
    }

    for (const file of selected) {
      const validationError = isVideoFile(file)
        ? validateVideoFile(file)
        : validateImageFile(file);
      if (validationError) {
        setFileError(validationError);
        return;
      }
    }

    setFileError("");
    setFiles((prev) => [...prev, ...selected]);
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !deliveredBy.trim()) return;
    setSaving(true);
    await onSave(
      { text: text.trim(), deliveredBy: deliveredBy.trim(), relation: relation.trim() },
      files
    );
    setSaving(false);
  }

  const isUploading = uploadProgress && uploadProgress.length > 0;

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
            onClick={() => docFileInputRef.current?.click()}
            disabled={importing || saving}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {importing ? t("importing") : t("importFromFile")}
          </button>
        </div>
        <input
          ref={docFileInputRef}
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

      {/* Media upload */}
      <div>
        <label className="block text-sm font-medium text-warm-700">
          {t("mediaLabel")}
        </label>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative size-20 overflow-hidden rounded-lg bg-warm-100"
              >
                {isVideoFile(file) ? (
                  <VideoThumbnail
                    src={URL.createObjectURL(file)}
                    className="size-full object-cover"
                  />
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
                  disabled={saving}
                  className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < 5 && !saving && (
          <div className="mt-2">
            <input
              ref={mediaFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              multiple
              onChange={handleMediaChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => mediaFileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-warm-300 px-4 py-2 text-sm text-warm-500 hover:border-accent hover:text-accent"
            >
              {t("addMedia")}
            </button>
          </div>
        )}
        {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="space-y-2">
          {uploadProgress.map((up, i) => (
            <UploadProgressBar
              key={i}
              progress={up.progress}
              label={up.fileName}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving
            ? isUploading
              ? t("uploading")
              : t("saving")
            : initialData
              ? t("update")
              : t("add")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

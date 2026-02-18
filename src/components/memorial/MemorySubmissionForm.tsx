"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import { validateImageFile, uploadMemoryImage } from "@/lib/upload";

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
  const [name, setName] = useState(session?.user?.name || "");
  const [withholdName, setWithholdName] = useState(false);
  const [relation, setRelation] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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
      // 1. Create the memory
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

      // 2. Upload images if any
      for (const file of files) {
        await uploadMemoryImage(memorialId, memory.id, file);
      }

      // Success
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
      setError("Maximum 5 images per memory");
      return;
    }

    for (const file of selected) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError("");
    setFiles((prev) => [...prev, ...selected]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  if (success) {
    return (
      <div className="rounded-lg border border-gold-400 bg-gold-300/10 p-6 text-center">
        <p className="font-heading text-base font-semibold text-warm-800">
          Thank you for sharing your memory
        </p>
        <p className="mt-2 text-sm text-warm-600">
          Your submission has been received and is awaiting review by the page
          owner.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setSuccess(false)}
        >
          Share another memory
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
          Your name <span className="text-red-500">*</span>
        </label>
        <input
          id="memory-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder="Your name"
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
          Display as anonymous
        </span>
      </label>

      <div>
        <label
          htmlFor="memory-relation"
          className="block text-sm font-medium text-warm-700"
        >
          Relation
        </label>
        <input
          id="memory-relation"
          type="text"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className={inputClass}
          placeholder="e.g. Friend, Colleague, Neighbor"
        />
      </div>

      <div>
        <label
          htmlFor="memory-text"
          className="block text-sm font-medium text-warm-700"
        >
          Your memory <span className="text-red-500">*</span>
        </label>
        <textarea
          id="memory-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={5}
          className={inputClass}
          placeholder="Share your memory..."
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-warm-700">
          Photos (optional, up to 5)
        </label>
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative size-20 overflow-hidden rounded-lg bg-warm-100"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
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
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-warm-300 px-4 py-2 text-sm text-warm-500 hover:border-accent hover:text-accent"
            >
              Add photos
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" variant="primary" size="sm" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Memory"}
      </Button>
    </form>
  );
}

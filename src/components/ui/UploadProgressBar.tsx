"use client";

type UploadProgressBarProps = {
  /** Progress value between 0 and 1. */
  progress: number;
  /** Optional label shown above the bar. */
  label?: string;
  /** Show cancel button. */
  onCancel?: () => void;
  cancelLabel?: string;
};

export default function UploadProgressBar({
  progress,
  label,
  onCancel,
  cancelLabel = "Cancel",
}: UploadProgressBarProps) {
  const percent = Math.min(100, Math.round(progress * 100));

  return (
    <div className="w-full space-y-1">
      {(label || onCancel) && (
        <div className="flex items-center justify-between text-xs text-warm-600">
          <span>{label}</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-warm-500 hover:text-red-600 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-warm-200">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="text-right text-xs text-warm-500">{percent}%</div>
    </div>
  );
}

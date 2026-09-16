import { useEffect, type ReactNode } from "react";
import { Button } from "../primitives/Button";

interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `"destructive"` (default) for an irreversible/dangerous action; use
   * `"primary"` for a plain confirmation that isn't itself dangerous (e.g.
   * "transcode this file", which only becomes destructive if the extra
   * `content` slot's own checkbox is checked). */
  confirmVariant?: "destructive" | "primary";
  /** Extra content between the body and the buttons — a checkbox option, an
   * input, anything a plain confirm doesn't need. Absorbs what would
   * otherwise be a one-off dialog variant (e.g. "delete original file too?"). */
  content?: ReactNode;
}

/** Generic confirmation dialog (blurred backdrop, closes on Escape/outside
 * click, destructive-red confirm button by default) — the base every
 * specific "confirm X" dialog in the app should build on rather than
 * duplicating this layout. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = "destructive",
  content,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="animate-modal-in w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="mb-2 text-sm font-medium text-text">
          {title}
        </h2>
        <div className="mb-4 text-xs text-text-muted">{body}</div>
        {content}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import MarkdownRenderer from "@/components/common/MarkdownRenderer";

type InlineMarkdownFieldProps = {
  value: string;
  placeholder?: string;
  canEdit?: boolean;
  onSave: (nextValue: string) => Promise<void>;
};

const DISCARD_MESSAGE = "Discard changes?";

const formattingHint =
  "Use # headings, **bold**, _italic_, bullet lists, links, and `code`.";

export default function InlineMarkdownField({
  value,
  placeholder = "Add a description…",
  canEdit = true,
  onSave,
}: InlineMarkdownFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<"save" | "cancel" | null>(null);

  const trimmedValue = value ?? "";
  const hasChanges = useMemo(() => draft !== trimmedValue, [draft, trimmedValue]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(trimmedValue);
      setSaveError(null);
    }
  }, [isEditing, trimmedValue]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !hasChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      if (anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!window.confirm(DISCARD_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasChanges, isEditing]);

  const enterEditMode = () => {
    if (!canEdit) return;
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (!hasChanges) {
      setIsEditing(false);
      setSaveError(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save description.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
      actionRef.current = null;
    }
  };

  const handleCancel = () => {
    setDraft(trimmedValue);
    setIsEditing(false);
    setSaveError(null);
    actionRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSave();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    if (!isEditing || isSaving) return;
    if (actionRef.current) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && containerRef.current?.contains(nextTarget)) return;
    void handleSave();
  };

  return (
    <div ref={containerRef} onBlurCapture={handleBlurCapture} className="space-y-3">
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={16}
            className="min-h-[320px] w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-50"
            placeholder={placeholder}
          />

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onMouseDown={() => {
                actionRef.current = "save";
              }}
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onMouseDown={() => {
                actionRef.current = "cancel";
              }}
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            >
              Cancel
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400" title={formattingHint}>
              Formatting help
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Description
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={enterEditMode}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900"
              >
                <span aria-hidden>✎</span>
                Edit
              </button>
            )}
          </div>

          <div
            className={`min-h-[320px] rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/40 ${
              canEdit ? "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700" : ""
            }`}
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : -1}
            onClick={enterEditMode}
            onKeyDown={(event) => {
              if (!canEdit) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                enterEditMode();
              }
            }}
          >
            {trimmedValue.trim() ? (
              <MarkdownRenderer
                content={trimmedValue}
                className="markdown-content text-sm text-slate-800 dark:text-slate-100"
              />
            ) : (
              <p className="text-slate-400 dark:text-slate-500">{placeholder}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

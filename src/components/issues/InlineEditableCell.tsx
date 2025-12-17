"use client";

import { useEffect, useMemo, useState } from "react";

export type SelectOption = { value: string; label: string };

type BaseProps = {
  disabled?: boolean;
  placeholder?: string;
  onSave: (value: any) => Promise<boolean>;
  labelRenderer?: (value: any) => React.ReactNode;
};

type InlineSelectProps = BaseProps & {
  value: string | null;
  options: SelectOption[];
  allowEmpty?: boolean;
};

type InlineNumberProps = BaseProps & {
  value: number | null;
};

type InlineUserSelectProps = BaseProps & {
  value: string | null;
  options: SelectOption[];
};

function EditableWrapper({
  disabled,
  isEditing,
  isSaving,
  onClick,
  children,
}: {
  disabled?: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group inline-flex min-w-[120px] items-center gap-2 rounded-md ${
        disabled
          ? "cursor-default"
          : "cursor-pointer transition hover:bg-slate-50 hover:shadow-sm dark:hover:bg-slate-800/60"
      } px-2 py-1`}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick?.();
      }}
    >
      <div className="flex-1 min-w-0 text-slate-800 dark:text-slate-100">
        {children}
      </div>
      {!disabled && !isEditing && !isSaving && (
        <svg
          className="h-3 w-3 text-slate-400 opacity-0 transition group-hover:opacity-100"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M13.586 3a2 2 0 011.414.586l1.414 1.414a2 2 0 010 2.828l-7.793 7.793a1 1 0 01-.45.263l-3.18.795a.5.5 0 01-.606-.606l.795-3.18a1 1 0 01.263-.45l7.793-7.793A2 2 0 0113.586 3zM13 5l-7.5 7.5-.5 2 2-.5L15 6l-2-1z" />
        </svg>
      )}
      {isSaving && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      )}
    </div>
  );
}

export function InlineSelectCell({
  value,
  options,
  allowEmpty = false,
  disabled,
  placeholder = "—",
  onSave,
  labelRenderer,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  const resolvedLabel = useMemo(() => {
    if (labelRenderer) return labelRenderer(value);

    const resolved = options.find((option) => option.value === value)?.label;
    return resolved ?? placeholder;
  }, [labelRenderer, options, placeholder, value]);

  const handleSave = async (nextValue: string | null) => {
    if (isSaving) return;
    setIsSaving(true);

    const success = await onSave(nextValue);

    if (!success) {
      setDraft(value);
    }

    setIsSaving(false);
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className="min-w-[140px]" onClick={(event) => event.stopPropagation()}>
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={draft ?? ""}
          onChange={(event) => {
            const nextValue = event.target.value || null;
            setDraft(nextValue);
            void handleSave(nextValue);
          }}
          onBlur={() => void handleSave(draft)}
        >
          {allowEmpty && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <EditableWrapper
      disabled={disabled}
      isEditing={isEditing}
      isSaving={isSaving}
      onClick={() => setIsEditing(true)}
    >
      {resolvedLabel}
    </EditableWrapper>
  );
}

export function InlineNumberCell({
  value,
  disabled,
  placeholder = "—",
  onSave,
}: InlineNumberProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value?.toString() ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value?.toString() ?? "");
    }
  }, [value, isEditing]);

  const handleSave = async () => {
    if (isSaving) return;

    const nextValue = draft === "" ? null : Number(draft);
    setIsSaving(true);
    const success = await onSave(Number.isNaN(nextValue) ? null : nextValue);

    if (!success) {
      setDraft(value?.toString() ?? "");
    }

    setIsSaving(false);
    setIsEditing(false);
  };

  if (isEditing && !disabled) {
    return (
      <div className="min-w-[100px]" onClick={(event) => event.stopPropagation()}>
        <input
          type="number"
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void handleSave()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSave();
            }
            if (event.key === "Escape") {
              setDraft(value?.toString() ?? "");
              setIsEditing(false);
            }
          }}
          min={0}
          step={1}
        />
      </div>
    );
  }

  return (
    <EditableWrapper
      disabled={disabled}
      isEditing={isEditing}
      isSaving={isSaving}
      onClick={() => setIsEditing(true)}
    >
      {value === null || value === undefined ? placeholder : value}
    </EditableWrapper>
  );
}

export function InlineUserSelectCell({
  value,
  options,
  disabled,
  onSave,
  labelRenderer,
}: InlineUserSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  const label = useMemo(() => {
    if (labelRenderer) return labelRenderer(value);

    const resolved = options.find((option) => option.value === value)?.label;
    return resolved ?? "Unassigned";
  }, [labelRenderer, options, value]);

  const handleSave = async (nextValue: string | null) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const success = await onSave(nextValue);

      if (!success) {
        setDraft(value);
      }
    } catch (error) {
      console.error("Failed to save assignee selection", error);
      setDraft(value);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  if (isEditing && !disabled) {
    return (
      <div className="min-w-[140px]" onClick={(event) => event.stopPropagation()}>
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={draft ?? ""}
          onChange={(event) => {
            const nextValue = event.target.value || null;
            setDraft(nextValue);
            void handleSave(nextValue);
          }}
          onBlur={() => void handleSave(draft)}
        >
          <option value="">Unassigned</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <EditableWrapper
      disabled={disabled}
      isEditing={isEditing}
      isSaving={isSaving}
      onClick={() => setIsEditing(true)}
    >
      {label}
    </EditableWrapper>
  );
}

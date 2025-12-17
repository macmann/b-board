import type { ChangeEvent, FormEvent } from "react";
import Button from "@/components/ui/Button";

const inputClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50";

const labelClasses = "text-sm font-medium text-slate-700 dark:text-slate-200";

type GeneralTabProps = {
  name: string;
  keyValue: string;
  description: string;
  createdAt: string;
  iconUrl: string;
  iconInitial: string;
  iconMessage: string | null;
  iconError: string | null;
  iconPreviewError: boolean;
  isAdmin: boolean;
  isSaving: boolean;
  isUploadingIcon: boolean;
  status: string | null;
  onNameChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onIconUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onIconRemove: () => void;
  onPreviewError: () => void;
};

export default function GeneralTab({
  name,
  keyValue,
  description,
  createdAt,
  iconUrl,
  iconInitial,
  iconMessage,
  iconError,
  iconPreviewError,
  isAdmin,
  isSaving,
  isUploadingIcon,
  status,
  onNameChange,
  onKeyChange,
  onDescriptionChange,
  onSubmit,
  onIconUpload,
  onIconRemove,
  onPreviewError,
}: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              General
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage the basics for your project.
            </p>
          </div>
          {status && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-icon">
              Project icon
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {iconUrl && !iconPreviewError ? (
                  <img
                    src={iconUrl}
                    alt="Project icon"
                    className="h-full w-full object-cover"
                    onError={onPreviewError}
                  />
                ) : (
                  <span>{iconInitial}</span>
                )}
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  id="project-icon"
                  type="file"
                  accept="image/*"
                  onChange={onIconUpload}
                  disabled={!isAdmin || isUploadingIcon}
                  className="text-xs text-slate-700 file:mr-3 file:rounded-md file:border-none file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary/90 disabled:cursor-not-allowed"
                />
                <p>PNG, JPG, or GIF up to 2MB.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onIconRemove}
                    disabled={!iconUrl || isUploadingIcon || !isAdmin}
                    className="px-3 py-1 text-xs"
                  >
                    Remove icon
                  </Button>
                  {isUploadingIcon && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Saving...
                    </span>
                  )}
                </div>
                {iconMessage && (
                  <p className="text-[11px] text-emerald-600">{iconMessage}</p>
                )}
                {iconError && <p className="text-[11px] text-red-600">{iconError}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={!isAdmin}
              className={inputClasses}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="project-key">
                Project key
              </label>
              <input
                id="project-key"
                type="text"
                value={keyValue}
                onChange={(e) => onKeyChange(e.target.value)}
                disabled={!isAdmin}
                className={inputClasses}
                required
              />
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Changing the key can impact integrations and links.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={labelClasses} htmlFor="project-created">
                Created
              </label>
              <input
                id="project-created"
                type="text"
                value={createdAt}
                readOnly
                className={`${inputClasses} cursor-not-allowed bg-slate-50 dark:bg-slate-800`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClasses} htmlFor="project-description">
              Description
            </label>
            <textarea
              id="project-description"
              rows={4}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              disabled={!isAdmin}
              className={inputClasses}
            />
          </div>

          {isAdmin && (
            <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

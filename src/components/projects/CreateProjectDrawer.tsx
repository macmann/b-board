"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import Button from "../ui/Button";

type CreateProjectDrawerProps = {
  onCreated?: () => Promise<void> | void;
};

export default function CreateProjectDrawer({ onCreated }: CreateProjectDrawerProps) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setKey("");
    setName("");
    setDescription("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name, description }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to create project.");
        return;
      }

      resetForm();
      setOpen(false);
      await onCreated?.();
    } catch (err) {
      setError("An unexpected error occurred while creating the project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>Create Project</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 animate-fade-in" />
        <Dialog.Content className="fixed right-0 top-0 flex h-full w-full max-w-md flex-col gap-4 bg-white p-6 shadow-xl animate-slide-in-right">
          <div className="space-y-1">
            <Dialog.Title className="text-lg font-semibold">Create project</Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500">
              Create a new project workspace.
            </Dialog.Description>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <form className="flex flex-1 flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="project-key">
                Key
              </label>
              <input
                id="project-key"
                name="key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="project-name">
                Name
              </label>
              <input
                id="project-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700" htmlFor="project-description">
                Description (optional)
              </label>
              <textarea
                id="project-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create project"}
              </Button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

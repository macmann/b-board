"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Role } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { routes } from "@/lib/routes";

const GeneralTab = lazy(() => import("./tabs/GeneralTab"));
const FeaturesTab = lazy(() => import("./tabs/FeaturesTab"));
const TeamPermissionsTab = lazy(
  () => import("./tabs/TeamPermissionsTab")
);
const AIAutomationTab = lazy(() => import("./tabs/AIAutomationTab"));
const AuditSecurityTab = lazy(() => import("./tabs/AuditSecurityTab"));
const DangerZoneTab = lazy(() => import("./tabs/DangerZoneTab"));
const BulkOperationsTab = lazy(() => import("./tabs/BulkOperationsTab"));

type ProjectSettingsPageClientProps = {
  project: {
    id: string;
    key: string;
    name: string;
    description: string;
    iconUrl: string | null;
    enableResearchBoard: boolean;
    createdAt: string;
    updatedAt: string;
  };
  members: {
    id: string;
    createdAt?: string;
    role: Role;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
  projectRole: ProjectRole | null;
  aiSettings: {
    backlogGroomingEnabled: boolean;
  };
  sprints: {
    id: string;
    name: string;
    status: string;
  }[];
  epics: {
    id: string;
    title: string;
    status: string;
  }[];
  initialTab?: TabKey;
};

type TabKey =
  | "general"
  | "features"
  | "team"
  | "ai"
  | "audit"
  | "danger"
  | "bulk";

type TabConfig = { id: TabKey; label: string; adminOnly?: boolean };

const tabs: TabConfig[] = [
  { id: "general", label: "General" },
  { id: "features", label: "Features" },
  { id: "team", label: "Team & Permissions" },
  { id: "ai", label: "AI & Automation" },
  { id: "audit", label: "Audit & Security" },
  { id: "danger", label: "Danger Zone" },
  { id: "bulk", label: "Bulk Operations", adminOnly: true },
];

export default function ProjectSettingsPageClient({
  project,
  members,
  projectRole,
  aiSettings,
  sprints,
  epics,
  initialTab,
}: ProjectSettingsPageClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab ?? "general"
  );
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description);
  const [enableResearchBoard, setEnableResearchBoard] = useState(
    project.enableResearchBoard
  );
  const [backlogGroomingEnabled, setBacklogGroomingEnabled] = useState(
    aiSettings.backlogGroomingEnabled
  );
  const [aiSuggestionScope, setAiSuggestionScope] = useState<
    "backlog" | "sprint" | "research"
  >("backlog");

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [featureStatus, setFeatureStatus] = useState<string | null>(null);
  const [aiStatus, setAIStatus] = useState<string | null>(null);
  const [dangerStatus, setDangerStatus] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState("");
  const [iconUrl, setIconUrl] = useState(project.iconUrl ?? "");
  const [iconError, setIconError] = useState<string | null>(null);
  const [iconMessage, setIconMessage] = useState<string | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [iconPreviewError, setIconPreviewError] = useState(false);

  const isAdmin = useMemo(
    () => projectRole === "ADMIN" || projectRole === "PO",
    [projectRole]
  );

  const formattedCreatedAt = useMemo(() => {
    const parsed = new Date(project.createdAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString();
  }, [project.createdAt]);

  const iconInitial = useMemo(() => {
    const source = project.key || project.name;
    return source ? source.charAt(0).toUpperCase() : "?";
  }, [project.key, project.name]);

  const visibleTabs = useMemo(() => {
    const list = tabs.filter((tab) => !tab.adminOnly || isAdmin);
    if (list.length === 0) return tabs.filter((tab) => tab.id === "general");
    return list;
  }, [isAdmin]);

  const patchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, key, description, enableResearchBoard }),
      });

      if (!response.ok) {
        return false;
      }

      router.refresh();
      return true;
    } catch (err) {
      return false;
    }
  }, [description, enableResearchBoard, key, name, project.id, router]);

  const persistAISettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/ai-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          backlogGroomingEnabled,
          model: null,
          temperature: null,
        }),
      });

      if (!response.ok) {
        return { success: false, enabled: backlogGroomingEnabled };
      }

      const data = await response.json().catch(() => null);
      const isEnabled = Boolean(
        data?.backlogGroomingEnabled ?? backlogGroomingEnabled
      );
      setBacklogGroomingEnabled(isEnabled);
      router.refresh();
      return { success: true, enabled: isEnabled };
    } catch (err) {
      return { success: false, enabled: backlogGroomingEnabled };
    }
  }, [backlogGroomingEnabled, project.id, router]);

  const handleSaveGeneral = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin) return;

    setIsSavingGeneral(true);
    setStatus(null);

    const success = await patchProject();

    setIsSavingGeneral(false);
    setStatus(
      success ? "Project updated successfully." : "Failed to update project."
    );
  };

  const handleSaveFeatureSettings = async () => {
    if (!isAdmin) return;

    setIsSavingFeatures(true);
    setFeatureStatus(null);

    const projectSuccess = await patchProject();
    const { success: aiSuccess } = await persistAISettings();

    setIsSavingFeatures(false);
    setFeatureStatus(
      projectSuccess && aiSuccess
        ? "Feature settings saved."
        : "Failed to save feature settings."
    );
  };

  const handleUpdateAISettings = async () => {
    if (!isAdmin) return;

    setIsSavingAISettings(true);
    setAIStatus(null);

    const { success, enabled } = await persistAISettings();

    setIsSavingAISettings(false);
    setAIStatus(
      success
        ? enabled
          ? "Backlog grooming AI enabled for this project."
          : "Backlog grooming AI disabled for this project."
        : "Failed to update AI settings. Please try again."
    );
  };

  const handleDeleteProject = async () => {
    if (!isAdmin || confirmKey !== key) return;

    setIsDeleting(true);
    setDangerStatus(null);

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });

    setIsDeleting(false);

    if (!response.ok) {
      setDangerStatus("Failed to delete project. Please try again.");
      return;
    }

    router.push(routes.myProjects());
  };

  const handleIconUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;

    const file = event.target.files?.[0];
    setIconError(null);
    setIconMessage(null);

    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      setIconError("Please upload an image file (PNG, JPG, or GIF).");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setIconError("Images must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploadingIcon(true);

    try {
      const formData = new FormData();
      formData.append("icon", file);

      const response = await fetch(`/api/projects/${project.id}/icon`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIconError(data?.message ?? "Failed to upload project icon.");
        return;
      }

      const newUrl = (data?.iconUrl as string | null) ?? "";
      setIconUrl(newUrl);
      setIconMessage("Project icon updated.");
      setIconPreviewError(false);
      router.refresh();
    } catch (err) {
      setIconError("Unable to upload project icon. Please try again.");
    } finally {
      setIsUploadingIcon(false);
      event.target.value = "";
    }
  };

  const handleIconRemove = async () => {
    if (!isAdmin) return;

    setIconError(null);
    setIconMessage(null);
    setIsUploadingIcon(true);

    try {
      const response = await fetch(`/api/projects/${project.id}/icon`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIconError(data?.message ?? "Failed to remove project icon.");
        return;
      }

      setIconUrl("");
      setIconPreviewError(false);
      setIconMessage("Project icon removed.");
      router.refresh();
    } catch (err) {
      setIconError("Unable to remove project icon. Please try again.");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const focusTab = (tabId: TabKey) => {
    const button = document.getElementById(`settings-tab-${tabId}`);
    button?.focus();
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    tabsList: TabConfig[]
  ) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + tabsList.length) % tabsList.length;
    const nextTab = tabsList[nextIndex];
    setActiveTab(nextTab.id);
    focusTab(nextTab.id);
  };

  const ensureActiveTabVisible = useCallback(
    (tabsList: TabConfig[]) => {
      const isVisible = tabsList.some((tab) => tab.id === activeTab);
      if (!isVisible && tabsList[0]) {
        setActiveTab(tabsList[0].id);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    ensureActiveTabVisible(visibleTabs);
  }, [ensureActiveTabVisible, visibleTabs]);

  return (
    <div className="w-full space-y-4 px-6 pb-12 lg:px-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Project settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {project.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Key: {project.key} · Created {formattedCreatedAt}
        </p>
      </header>

      <nav className="sticky top-16 z-20 w-full border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div
          className="flex w-full flex-row gap-2 overflow-x-auto py-2"
          role="tablist"
          aria-label="Project settings sections"
        >
          {visibleTabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`settings-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) =>
                  handleTabKeyDown(event, index, visibleTabs)
                }
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div
        className="pt-2"
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        <Suspense fallback={<div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">Loading settings...</div>}>
          {activeTab === "general" && (
            <GeneralTab
              name={name}
              keyValue={key}
              description={description}
              createdAt={formattedCreatedAt}
              iconUrl={iconUrl}
              iconInitial={iconInitial}
              iconMessage={iconMessage}
              iconError={iconError}
              iconPreviewError={iconPreviewError}
              isAdmin={isAdmin}
              isSaving={isSavingGeneral}
              status={status}
              isUploadingIcon={isUploadingIcon}
              onNameChange={setName}
              onKeyChange={setKey}
              onDescriptionChange={setDescription}
              onSubmit={handleSaveGeneral}
              onIconUpload={handleIconUpload}
              onIconRemove={handleIconRemove}
              onPreviewError={() => setIconPreviewError(true)}
            />
          )}

          {activeTab === "features" && (
            <FeaturesTab
              isAdmin={isAdmin}
              backlogGroomingEnabled={backlogGroomingEnabled}
              setBacklogGroomingEnabled={setBacklogGroomingEnabled}
              enableResearchBoard={enableResearchBoard}
              setEnableResearchBoard={setEnableResearchBoard}
              isSaving={isSavingFeatures}
              status={featureStatus}
              onSave={handleSaveFeatureSettings}
              projectId={project.id}
              projectRole={projectRole}
            />
          )}

          {activeTab === "team" && (
            <TeamPermissionsTab
              isAdmin={isAdmin}
              members={members}
              projectId={project.id}
              projectRole={projectRole}
            />
          )}

          {activeTab === "ai" && (
            <AIAutomationTab
              isAdmin={isAdmin}
              backlogGroomingEnabled={backlogGroomingEnabled}
              setBacklogGroomingEnabled={setBacklogGroomingEnabled}
              aiSuggestionScope={aiSuggestionScope}
              setAiSuggestionScope={setAiSuggestionScope}
              isSaving={isSavingAISettings}
              status={aiStatus}
              onSave={handleUpdateAISettings}
            />
          )}

          {activeTab === "audit" && (
            <AuditSecurityTab
              isAdmin={isAdmin}
              projectId={project.id}
            />
          )}

          {activeTab === "bulk" && isAdmin && (
            <BulkOperationsTab
              projectId={project.id}
              members={members}
              sprints={sprints}
              epics={epics}
            />
          )}

          {activeTab === "danger" && isAdmin && (
            <DangerZoneTab
              keyValue={key}
              confirmKey={confirmKey}
              onConfirmKeyChange={setConfirmKey}
              onDelete={handleDeleteProject}
              isDeleting={isDeleting}
              status={dangerStatus}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

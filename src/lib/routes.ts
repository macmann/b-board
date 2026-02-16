const projectBase = (projectId: string) => `/projects/${projectId}`;
const projectSettings = (projectId: string) => `${projectBase(projectId)}/settings`;

export const routes = {
  home: () => "/",
  login: () => "/login",
  register: () => "/register",
  dashboard: () => "/dashboard",
  myProjects: () => "/my-projects",
  reports: () => "/reports",
  profile: () => "/profile",
  executionAlerts: () => "/execution-alerts",
  projects: () => "/projects",
  myProjectLegacy: () => "/my-project",
  project: {
    base: projectBase,
    backlog: (projectId: string) => `${projectBase(projectId)}/backlog`,
    board: (projectId: string) => `${projectBase(projectId)}/board`,
    builds: (projectId: string) => `${projectBase(projectId)}/builds`,
    epics: (projectId: string) => `${projectBase(projectId)}/epics`,
    build: (projectId: string, buildId: string) =>
      `${projectBase(projectId)}/builds/${buildId}`,
    sprints: (projectId: string) => `${projectBase(projectId)}/sprints`,
    reports: (projectId: string) => `${projectBase(projectId)}/reports`,
    qa: (projectId: string) => `${projectBase(projectId)}/qa`,
    standup: (projectId: string) => `${projectBase(projectId)}/standup`,
    executionAlerts: (projectId: string) => `${projectBase(projectId)}/execution-alerts`,
    settings: projectSettings,
    settingsImport: (projectId: string) => `${projectSettings(projectId)}/import`,
    settingsDangerZone: (projectId: string) => `${projectSettings(projectId)}#danger-zone`,
  },
};

export type Routes = typeof routes;

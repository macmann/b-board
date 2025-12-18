const projectBase = (projectId: string) => `/projects/${projectId}`;
const projectSettings = (projectId: string) => `${projectBase(projectId)}/settings`;

export const routes = {
  home: () => "/",
  login: () => "/login",
  register: () => "/register",
  dashboard: () => "/dashboard",
  myProjects: () => "/my-projects",
  reports: () => "/reports",
  projects: () => "/projects",
  myProjectLegacy: () => "/my-project",
  project: {
    base: projectBase,
    backlog: (projectId: string) => `${projectBase(projectId)}/backlog`,
    board: (projectId: string) => `${projectBase(projectId)}/board`,
    builds: (projectId: string) => `${projectBase(projectId)}/builds`,
    build: (projectId: string, buildId: string) =>
      `${projectBase(projectId)}/builds/${buildId}`,
    sprints: (projectId: string) => `${projectBase(projectId)}/sprints`,
    reports: (projectId: string) => `${projectBase(projectId)}/reports`,
    standup: (projectId: string) => `${projectBase(projectId)}/standup`,
    settings: projectSettings,
    settingsImport: (projectId: string) => `${projectSettings(projectId)}/import`,
    settingsDangerZone: (projectId: string) => `${projectSettings(projectId)}#danger-zone`,
  },
};

export type Routes = typeof routes;

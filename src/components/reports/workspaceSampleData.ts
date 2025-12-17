export type PortfolioProject = {
  id: string;
  name: string;
  status: "on-track" | "at-risk" | "off-track";
  category: string;
  healthScore: number;
  throughputPerWeek: number;
  predictability: number;
  leadTimeDays: number;
  blockers: { theme: string; count: number; lastSeen: string }[];
  issueStatuses: { backlog: number; inProgress: number; blocked: number; done: number };
  agingIssues: { key: string; title: string; ageDays: number; owner: string }[];
  lastActivityDays: number;
  adoption: { weeklyActive: number; monthlyActive: number; updateRate: number; firstResponseRate: number };
  roles: { admin: number; po: number; dev: number; qa: number };
  orphaned: { unassigned: number; missingParent: number; stalled: number };
};

export const portfolioProjects: PortfolioProject[] = [
  {
    id: "proj-neptune",
    name: "Neptune Platform",
    status: "on-track",
    category: "Platform",
    healthScore: 82,
    throughputPerWeek: 52,
    predictability: 0.9,
    leadTimeDays: 3.8,
    blockers: [
      { theme: "Dependency", count: 3, lastSeen: "2024-04-18" },
      { theme: "Env stability", count: 2, lastSeen: "2024-04-16" },
    ],
    issueStatuses: { backlog: 28, inProgress: 19, blocked: 2, done: 74 },
    agingIssues: [
      {
        key: "NEP-142",
        title: "Service registry migration",
        ageDays: 24,
        owner: "Samira",
      },
      { key: "NEP-131", title: "Flaky CI pipeline", ageDays: 19, owner: "Alex" },
    ],
    lastActivityDays: 2,
    adoption: {
      weeklyActive: 26,
      monthlyActive: 41,
      updateRate: 0.83,
      firstResponseRate: 0.78,
    },
    roles: { admin: 2, po: 2, dev: 14, qa: 4 },
    orphaned: { unassigned: 1, missingParent: 2, stalled: 3 },
  },
  {
    id: "proj-apollo",
    name: "Apollo Mobile",
    status: "at-risk",
    category: "Mobile",
    healthScore: 66,
    throughputPerWeek: 37,
    predictability: 0.72,
    leadTimeDays: 5.6,
    blockers: [
      { theme: "Design dependency", count: 4, lastSeen: "2024-04-19" },
      { theme: "External API", count: 3, lastSeen: "2024-04-14" },
      { theme: "QA capacity", count: 2, lastSeen: "2024-04-12" },
    ],
    issueStatuses: { backlog: 42, inProgress: 21, blocked: 7, done: 58 },
    agingIssues: [
      { key: "APL-88", title: "Payment reconciliation", ageDays: 31, owner: "Jordan" },
      { key: "APL-93", title: "Push notification retries", ageDays: 22, owner: "Priya" },
    ],
    lastActivityDays: 11,
    adoption: {
      weeklyActive: 18,
      monthlyActive: 33,
      updateRate: 0.64,
      firstResponseRate: 0.69,
    },
    roles: { admin: 1, po: 1, dev: 11, qa: 3 },
    orphaned: { unassigned: 4, missingParent: 3, stalled: 5 },
  },
  {
    id: "proj-orion",
    name: "Orion Ops",
    status: "off-track",
    category: "Operations",
    healthScore: 54,
    throughputPerWeek: 29,
    predictability: 0.61,
    leadTimeDays: 7.2,
    blockers: [
      { theme: "Production incident", count: 2, lastSeen: "2024-04-17" },
      { theme: "Data quality", count: 3, lastSeen: "2024-04-15" },
    ],
    issueStatuses: { backlog: 33, inProgress: 17, blocked: 9, done: 41 },
    agingIssues: [
      { key: "ORI-44", title: "Legacy billing cleanup", ageDays: 46, owner: "Rae" },
      { key: "ORI-39", title: "Audit logging gaps", ageDays: 27, owner: "Lee" },
    ],
    lastActivityDays: 18,
    adoption: {
      weeklyActive: 12,
      monthlyActive: 25,
      updateRate: 0.57,
      firstResponseRate: 0.63,
    },
    roles: { admin: 1, po: 1, dev: 9, qa: 2 },
    orphaned: { unassigned: 6, missingParent: 4, stalled: 6 },
  },
];

export const deliveryTrend = [
  { week: "Week 1", throughput: 36, predictability: 0.71 },
  { week: "Week 2", throughput: 42, predictability: 0.76 },
  { week: "Week 3", throughput: 39, predictability: 0.73 },
  { week: "Week 4", throughput: 48, predictability: 0.82 },
  { week: "Week 5", throughput: 52, predictability: 0.85 },
  { week: "Week 6", throughput: 47, predictability: 0.8 },
];

export const adoptionTrend = [
  { week: "Week 1", activeUsers: 42, updates: 180 },
  { week: "Week 2", activeUsers: 47, updates: 195 },
  { week: "Week 3", activeUsers: 44, updates: 210 },
  { week: "Week 4", activeUsers: 53, updates: 236 },
  { week: "Week 5", activeUsers: 56, updates: 248 },
  { week: "Week 6", activeUsers: 59, updates: 261 },
];

export const agingBuckets = [
  { label: "0-7 days", count: 23 },
  { label: "8-14 days", count: 17 },
  { label: "15-30 days", count: 11 },
  { label: "31+ days", count: 7 },
];

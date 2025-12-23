import { Card } from "@/components/ui/Card";

const steps = [
  {
    title: "Create Project",
    description: "Set up the workspace with your team, branding, and delivery cadence.",
  },
  {
    title: "Manage Backlog",
    description: "Capture intake, prioritize, and shape work before it reaches the sprint.",
  },
  {
    title: "Run Sprint/Board",
    description: "Move cards through the board with clear ownership and guardrails.",
  },
  {
    title: "Standup + Reports",
    description: "Share daily updates and review reports like Sprint Burndown to stay on track.",
  },
];

export function WorkflowGlanceSection() {
  return (
    <section id="workflow-glance" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Workflow</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">Workflow at a glance.</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Four simple steps guide teams from project setup to daily rituals with reporting built-in.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <Card
            key={step.title}
            className="relative h-full border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80"
          >
            <div className="flex items-center justify-between text-xs text-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {index + 1}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-50">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

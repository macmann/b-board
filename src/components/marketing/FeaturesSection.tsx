import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const features = [
  {
    title: "Backlog + Sprints",
    description: "Plan and prioritize work across product backlog and sprints.",
  },
  {
    title: "Kanban Board",
    description: "Visualize work-in-progress and move issues across columns.",
  },
  {
    title: "Standup Updates",
    description: "Capture yesterday/today/blockers with linked issues.",
  },
  {
    title: "AI Standup Summary",
    description: "Generate digest summaries for PO/Admin to spot risks fast.",
  },
  {
    title: "Reports",
    description: "Burndown, velocity, cycle time and team insights.",
  },
  {
    title: "Team & Roles",
    description: "Admin/PO/member access with project-level controls.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Features</p>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Built for shipping, not ceremonies.</h2>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Keep teams aligned with one board that handles prioritization, standups, and reporting. Each card is fast by design, with familiar controls across light and dark modes.
          </p>
        </div>
        <Button asChild variant="secondary" className="shadow-sm">
          <a href="#contact">Contact us</a>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="h-full border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/60 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800/80 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
          >
            <CardHeader className="border-none pb-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{feature.title}</p>
            </CardHeader>
            <CardContent className="pt-3 text-sm text-slate-600 dark:text-slate-300">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

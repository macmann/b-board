import { Card } from "@/components/ui/Card";

const useCases = [
  {
    title: "Product Owner",
    description: "Track delivery, sprint health, and outcomes without digging through multiple tools.",
  },
  {
    title: "Scrum Master",
    description: "Run standups, clear blockers, and keep the team aligned on what matters this sprint.",
  },
  {
    title: "Engineering Team",
    description: "Manage backlog to sprint to board execution with a consistent, lightweight flow.",
  },
  {
    title: "Stakeholders",
    description: "View progress through reports that surface burndown, risks, and delivery highlights.",
  },
];

export function UseCasesSection() {
  return (
    <section id="use-cases" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Use cases</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">How teams use B Board.</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Designed for the people who ship: each role gets the clarity they need without extra overhead.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {useCases.map((useCase) => (
          <Card
            key={useCase.title}
            className="h-full border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{useCase.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{useCase.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

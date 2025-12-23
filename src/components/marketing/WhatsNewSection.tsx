import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const updates = [
  {
    title: "Daily Standup module",
    description:
      "Share your update, check the team dashboard, and review an AI-generated summary formatted in Markdown.",
  },
  {
    title: "Project Reports",
    description:
      "A project-level hub for reporting with Sprint Burndown available now and more report types on the way.",
  },
  {
    title: "Project Settings improvements",
    description:
      "Organized controls for leads and admins to fine-tune projects, manage roles, and keep delivery consistent.",
  },
  {
    title: "Branding updates",
    description:
      "Refreshed B Board naming and logo across the experience so teams know they are in the right workspace.",
  },
];

export function WhatsNewSection() {
  return (
    <section id="whats-new" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">What’s New</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">What’s new in B Board.</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Recent updates that make planning, running standups, and reporting simpler for every team.
          </p>
        </div>
        <Badge className="rounded-full bg-primary/10 px-4 py-2 text-primary shadow-sm dark:bg-primary/20">Just shipped</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {updates.map((item) => (
          <Card
            key={item.title}
            className="h-full border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

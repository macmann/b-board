const phases = [
  {
    name: "Phase 1 — AI-Driven Standup Intelligence",
    status: "Live / MVP",
    positioning: "The foundation layer focused on coordination clarity.",
    highlights: [
      "Structured daily standup input",
      "AI-generated sprint summaries",
      "Automatic blocker detection",
      "Dependency surfacing",
      "Stakeholder-ready executive digest",
      "Traceability to raw updates",
    ],
    outcome:
      "Enables real-time sprint visibility, reduces reporting overhead, and surfaces risk early — without replacing existing systems of record.",
  },
  {
    name: "Phase 2 — AI Scrum Master",
    status: "In Development",
    positioning: "The automation layer focused on proactive execution.",
    highlights: [
      "Automatic blocker escalation",
      "Intelligent nudges to responsible contributors",
      "Early sprint risk detection",
      "Real-time sprint health scoring",
      "\"Needs Attention Today\" summaries",
      "Automated weekly & sprint stakeholder reporting",
    ],
    outcome:
      "Reduces manual Scrum Master workload and shifts agile from reactive tracking to proactive execution intelligence.",
  },
  {
    name: "Phase 3 — Cross-Platform Execution Layer",
    status: "Platform Expansion",
    positioning: "The orchestration layer across tools.",
    highlights: ["Jira", "GitHub", "Linear", "Slack"],
    strategy:
      "BBoard does not replace systems of record — it sits above them as an AI execution intelligence layer that ensures successful delivery across ecosystems.",
    outcome: "Transforms BBoard into the autonomous coordination layer for product teams.",
  },
];

export function RoadmapSection() {
  return (
    <section id="roadmap" className="mt-16 space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Product Roadmap</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 sm:text-3xl">
          From Execution Intelligence to Autonomous Agile Orchestration
        </h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          BBoard is building the AI Scrum Master — an intelligent execution layer that transforms agile from manual coordination into
          autonomous delivery. Our roadmap reflects a deliberate evolution from standup intelligence to full execution automation across
          tools.
        </p>
      </div>

      <ol className="space-y-6 border-l border-slate-200 pl-6 dark:border-slate-800">
        {phases.map((phase, index) => (
          <li key={phase.name} className="relative">
            <span className="absolute -left-[33px] top-2 inline-flex h-4 w-4 rounded-full border-2 border-white bg-primary shadow dark:border-slate-950" />
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{phase.name}</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{phase.status}</span>
              </div>

              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{phase.positioning}</p>

              <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                {phase.highlights.map((item) => (
                  <li key={item} className="rounded-lg bg-slate-100/70 px-3 py-2 dark:bg-slate-800/70">
                    {item}
                  </li>
                ))}
              </ul>

              {phase.strategy ? <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{phase.strategy}</p> : null}

              <p className="mt-4 text-sm text-slate-800 dark:text-slate-100">
                <span className="font-semibold">Outcome:</span> {phase.outcome}
              </p>

              {index < phases.length - 1 ? <div className="mt-4 h-px bg-gradient-to-r from-primary/40 via-slate-200 to-transparent dark:via-slate-700" /> : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 text-sm font-medium text-slate-800 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-100">
        “In the same way DevOps automated infrastructure, BBoard is automating coordination. The future of agile is not managed — it is
        orchestrated.”
      </p>
    </section>
  );
}

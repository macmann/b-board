const roadmapPhases = [
  {
    phase: 'Phase 1',
    title: 'AI-Driven Standup Intelligence',
    position: 'The foundation layer focused on coordination clarity.',
    highlights: [
      'Structured daily standup input',
      'AI-generated sprint summaries',
      'Automatic blocker detection',
      'Dependency surfacing',
      'Stakeholder-ready executive digest',
      'Traceability to raw updates',
    ],
    outcome:
      'Enables real-time sprint visibility, reduces reporting overhead, and surfaces risk early — without replacing existing systems of record.',
    status: 'Live / MVP',
  },
  {
    phase: 'Phase 2',
    title: 'AI Scrum Master',
    position: 'The automation layer focused on proactive execution.',
    highlights: [
      'Automatic blocker escalation',
      'Intelligent nudges to responsible contributors',
      'Early sprint risk detection',
      'Real-time sprint health scoring',
      'Needs Attention Today summaries',
      'Automated weekly & sprint stakeholder reporting',
    ],
    outcome:
      'Reduces manual Scrum Master workload and shifts agile from reactive tracking to proactive execution intelligence.',
    status: 'In Development',
  },
  {
    phase: 'Phase 3',
    title: 'Cross-Platform Execution Layer',
    position: 'The orchestration layer across tools.',
    highlights: ['Jira', 'GitHub', 'Linear', 'Slack'],
    strategic:
      'BBoard does not replace systems of record — it sits above them as an AI execution intelligence layer that ensures successful delivery across ecosystems.',
    outcome: 'Transforms BBoard into the autonomous coordination layer for product teams.',
    status: 'Platform Expansion',
  },
];

export function RoadmapSection() {
  return (
    <section id="roadmap" className="mt-16 space-y-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Product Roadmap</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 sm:text-3xl">
          From Execution Intelligence to Autonomous Agile Orchestration
        </h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          BBoard is building the AI Scrum Master — an intelligent execution layer that transforms agile from
          manual coordination into autonomous delivery. Our roadmap reflects a deliberate evolution from standup
          intelligence to full execution automation across tools.
        </p>
      </div>

      <div className="relative pl-6 sm:pl-8">
        <div className="absolute left-[9px] top-0 h-full w-px bg-gradient-to-b from-primary/40 via-indigo-400/30 to-emerald-400/30 sm:left-3" />
        <div className="space-y-8">
          {roadmapPhases.map((item) => (
            <article
              key={item.phase}
              className="relative rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80"
            >
              <span className="absolute -left-[22px] top-7 h-4 w-4 rounded-full border-2 border-primary bg-white shadow dark:bg-slate-950 sm:-left-[30px]" />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">{item.phase}</p>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {item.status}
                </span>
              </div>

              <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.position}</p>

              <ul className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                {item.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              {item.strategic ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{item.strategic}</p> : null}

              <p className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200">
                <span className="font-semibold text-slate-900 dark:text-slate-50">Outcome: </span>
                {item.outcome}
              </p>
            </article>
          ))}
        </div>
      </div>

      <p className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm font-medium text-slate-800 dark:border-primary/30 dark:bg-primary/10 dark:text-slate-100 sm:text-base">
        “In the same way DevOps automated infrastructure, BBoard is automating coordination. The future of agile is
        not managed — it is orchestrated.”
      </p>
    </section>
  );
}

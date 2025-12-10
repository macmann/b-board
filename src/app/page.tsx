export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
              BB
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              B Board
            </span>
          </div>
          <a
            href="/login"
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white/60 dark:border-slate-600 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/70"
          >
            Login
          </a>
        </header>

        <section className="mt-16 grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              Agile, without the bloat
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-slate-50">
              A focused board for sprints, backlog, and delivery.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              B Board helps small product teams track epics, stories, bugs, sprints,
              and velocity without the complexity of a full Jira instance. Plan,
              prioritize, and ship together in a clean workspace.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
              >
                Go to app
              </a>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Use your existing B Board account to sign in.
              </span>
            </div>

            <dl className="mt-8 grid gap-4 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                <dt className="font-semibold text-slate-900 dark:text-slate-100">
                  Sprint & backlog
                </dt>
                <dd className="mt-1 leading-relaxed">
                  Plan sprints, move cards on boards, and keep the product backlog
                  in view.
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                <dt className="font-semibold text-slate-900 dark:text-slate-100">
                  Jira-friendly
                </dt>
                <dd className="mt-1 leading-relaxed">
                  Import projects and issues from Jira to start quickly.
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                <dt className="font-semibold text-slate-900 dark:text-slate-100">
                  Light & dark mode
                </dt>
                <dd className="mt-1 leading-relaxed">
                  Switch themes to match your environment and focus.
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Sprint Board · DEMO
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                In progress
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-[11px] text-slate-700 sm:grid-cols-3 dark:text-slate-200">
              <div className="rounded-lg bg-slate-100 p-3 shadow-sm dark:bg-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">
                  To Do
                </p>
                <p className="mt-2 truncate text-[11px] text-slate-700 dark:text-slate-200">
                  US-12 · Support email login
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  US-9 · Improve backlog filters
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 shadow-sm dark:bg-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">
                  In Progress
                </p>
                <p className="mt-2 truncate text-[11px] text-slate-700 dark:text-slate-200">
                  BUG-3 · Fix burndown chart
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  US-15 · Board keyboard shortcuts
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 shadow-sm dark:bg-slate-800/80">
                <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">
                  Done
                </p>
                <p className="mt-2 truncate text-[11px] text-emerald-600 dark:text-emerald-300">
                  US-1 · Create project
                </p>
                <p className="mt-1 truncate text-[11px] text-emerald-600 dark:text-emerald-300">
                  US-4 · Invite team members
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>© {new Date().getFullYear()} B Board. Built for focused teams.</p>
        </footer>
      </div>
    </main>
  );
}

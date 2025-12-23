import Logo from "@/components/branding/Logo";
import { ContactUsSection } from "@/components/marketing/ContactUsSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { UseCasesSection } from "@/components/marketing/UseCasesSection";
import { WhatsNewSection } from "@/components/marketing/WhatsNewSection";
import { WorkflowGlanceSection } from "@/components/marketing/WorkflowGlanceSection";
import { homepageEnabled } from "@/config/appConfig";
import { redirect } from "next/navigation";

export default function HomePage() {
  if (!homepageEnabled) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-white text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
        <div className="absolute -left-10 top-64 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/20" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/20" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80">
          <Logo subtitle="Ship faster with less overhead" />

          <nav className="flex items-center gap-6 text-sm text-slate-700 dark:text-slate-200">
            <a className="transition hover:text-primary" href="#features">
              Features
            </a>
            <a className="transition hover:text-primary" href="#workflow">
              Workflow
            </a>
            <a className="transition hover:text-primary" href="#highlights">
              Highlights
            </a>
            <a className="transition hover:text-primary" href="#screenshots">
              Screenshots
            </a>
            <a className="transition hover:text-primary" href="#contact">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <a
              href="https://github.com/macmann/b-board"
              target="_blank"
              rel="noreferrer"
              aria-label="View the B Board repository on GitHub"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2c-5.52 0-10 4.48-10 10 0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48 0-.24-.01-.87-.01-1.71-2.49.54-3.01-1.2-3.01-1.2-.45-1.14-1.11-1.45-1.11-1.45-.91-.63.07-.62.07-.62 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-1.99-.23-4.09-.99-4.09-4.4 0-.97.35-1.77.93-2.4-.09-.23-.4-1.16.09-2.42 0 0 .75-.24 2.45.92.71-.2 1.47-.3 2.23-.3.76 0 1.52.1 2.23.3 1.7-1.16 2.45-.92 2.45-.92.49 1.26.18 2.19.09 2.42.58.63.93 1.43.93 2.4 0 3.42-2.1 4.17-4.1 4.39.36.31.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .26.17.57.67.47A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10Z"
                />
              </svg>
            </a>
            <a
              href="/login"
              className="rounded-full bg-gradient-to-r from-primary to-indigo-500 px-5 py-2 font-semibold text-white shadow-lg shadow-primary/30 transition hover:brightness-110"
            >
              Try the demo
            </a>
          </div>
        </header>

        <section className="mt-14 grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              New: Sprint snapshots + recap emails
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Ship work, not status updates.</h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                B Board keeps sprints, backlog, and delivery aligned. Prioritize work, move cards, and publish weekly outcomes without the complexity of traditional project trackers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90"
              >
                Start a sprint
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">2 min setup</span>
              </a>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                See how it flows
              </a>
              <p className="text-xs text-slate-500 dark:text-slate-400">No seats to assign. Bring your team and ship together.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {["Lead time", "Sprint health", "Delivery", "Churn", "Bugs", "Velocity"].map((label, index) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {index % 2 === 0 ? "↑" : "↓"} {index % 2 === 0 ? "12%" : "6%"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Week over week</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative isolate overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute bottom-10 right-6 h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Sprint 12 · In progress</span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Recap auto-sent Fridays</span>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 shadow-inner dark:border-slate-800/80 dark:from-slate-900 dark:to-slate-950">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="text-slate-900 dark:text-slate-50">Board: Growth</span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Keyboard-first</span>
                </div>
                <div className="mt-3 grid gap-3 text-[11px] text-slate-700 sm:grid-cols-3 dark:text-slate-200">
                  {[
                    { title: "To Do", items: ["US-44 · Lead form enrich", "BUG-12 · Safari drag"], tone: "" },
                    { title: "In Progress", items: ["US-38 · Billing sync", "US-32 · Export audit"], tone: "" },
                    { title: "Done", items: ["US-18 · Slack alerts", "BUG-9 · Sprint freeze"], tone: "text-emerald-600 dark:text-emerald-300" },
                  ].map((column) => (
                    <div key={column.title} className="rounded-xl bg-slate-100/70 p-3 shadow-sm dark:bg-slate-800/70">
                      <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">{column.title}</p>
                      {column.items.map((item) => (
                        <p key={item} className={`mt-2 truncate text-[11px] ${column.tone || "text-slate-700 dark:text-slate-200"}`}>
                          {item}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">Status snapshot</p>
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    Friday, 4:00pm
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 shadow-inner dark:border-slate-800/60 dark:bg-slate-800/60">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">Velocity</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">48 / 50 pts</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-300">Ahead of plan</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 shadow-inner dark:border-slate-800/60 dark:bg-slate-800/60">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">Risks</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-300">2 blockers</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">Assign owners before Friday</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FeaturesSection />

        <ContactUsSection />

        <section id="workflow" className="mt-16 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Workflow</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">Calm in planning, fast in delivery.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Move from intake to done with simple guardrails. B Board keeps everyone aligned with one place to plan, prioritize, and share wins.
              </p>
            </div>
            <a
              href="/login"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              Open the workspace
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {[
              {
                title: "Prioritize",
                description: "Group work by outcome, stack-rank backlog, and set sprint focus in one view.",
              },
              {
                title: "Deliver",
                description: "Card-first boards with keyboard shortcuts keep flow state intact.",
              },
              {
                title: "Track",
                description: "Live burndown, velocity, and blockers surface automatically for leads.",
              },
              {
                title: "Share",
                description: "Weekly recap emails show what shipped, what's blocked, and what's next.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/80">{item.title}</p>
                <p className="mt-2 text-slate-700 dark:text-slate-200">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="highlights" className="mt-16 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Highlights</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">Tools that feel invisible.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Every interaction is optimized for focused teams: fewer clicks, faster updates, and a UI that stays consistent in light or dark mode.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Backlog refinement",
                description: "Import from Jira, drag to rank, and approve grooming suggestions instantly.",
              },
              {
                title: "Sprints with guardrails",
                description: "Capacity planning, committed scope locks, and auto-pause for off-weeks.",
              },
              {
                title: "Delivery insights",
                description: "Burndowns, blockers, and velocity trends rendered in real time for leads.",
              },
              {
                title: "Team rituals",
                description: "Daily standup summaries, retro prompts, and kudos cards built in.",
              },
              {
                title: "Security-ready",
                description: "SSO, audit trails, and least-privilege roles keep compliance simple.",
              },
              {
                title: "Themes that match",
                description: "Polished light and dark themes keep the interface legible everywhere.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800/80 dark:from-slate-900 dark:to-slate-950"
              >
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{feature.title}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
                </div>
                <div className="mt-4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              </div>
            ))}
          </div>
        </section>

        <section id="screenshots" className="mt-16 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Screenshots</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">A board built for clarity.</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Glimpse the workspace before you sign in. Every view pairs the same structure across light and dark so teams stay in sync.
              </p>
            </div>
            <a
              href="/login"
              className="rounded-full bg-gradient-to-r from-primary to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:brightness-110"
            >
              Launch the demo
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {["Board view", "Sprint recap"].map((title, index) => (
              <div
                key={title}
                className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-slate-800/80 dark:bg-slate-900/80"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-indigo-500/5 dark:from-primary/10 dark:to-indigo-500/10" />
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{title}</span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Live preview</span>
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 shadow-inner dark:border-slate-800/80 dark:from-slate-900 dark:to-slate-950">
                  {index === 0 ? (
                    <div className="grid gap-3 text-[11px] text-slate-700 sm:grid-cols-3 dark:text-slate-200">
                      {["Intake", "In progress", "Shipped"].map((column, colIndex) => (
                        <div key={column} className="rounded-xl bg-slate-100/80 p-3 shadow-sm dark:bg-slate-800/70">
                          <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">{column}</p>
                          <p className="mt-2 truncate text-[11px] text-slate-700 dark:text-slate-200">{colIndex + 1}. Customer ideas</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{colIndex + 4}. Bugs & follow-ups</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-inner dark:border-slate-800/80 dark:bg-slate-800/60">
                        <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">What shipped</p>
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
                          <li>US-44 · Lead form enrich</li>
                          <li>BUG-12 · Safari drag fix</li>
                          <li>US-32 · Export audit</li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-inner dark:border-slate-800/80 dark:bg-slate-800/60">
                        <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-50">What needs help</p>
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-700 dark:text-slate-200">
                          <li>US-38 · Billing sync</li>
                          <li>BUG-9 · Sprint freeze</li>
                          <li>Retro · Share learnings</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200/80 bg-gradient-to-r from-primary/10 via-indigo-500/10 to-emerald-400/10 p-8 text-center shadow-lg backdrop-blur dark:border-slate-800/80 dark:from-primary/20 dark:via-indigo-500/15 dark:to-emerald-400/15">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Call to action</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50">Ready to replace status meetings?</h2>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            Launch B Board, invite your team, and ship the next sprint with fewer updates and more momentum.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a
              href="/login"
              className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Go to B Board
            </a>
            <a
              href="#features"
              className="rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              Review the details
            </a>
          </div>
        </section>

        <WhatsNewSection />

        <UseCasesSection />

        <WorkflowGlanceSection />

        <FAQSection />

        <footer className="mt-12 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>© {new Date().getFullYear()} B Board. Built for focused teams.</p>
        </footer>
      </div>
    </main>
  );
}

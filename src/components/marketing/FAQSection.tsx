import { Card } from "@/components/ui/Card";

const faqs = [
  {
    question: "Is it a Jira replacement?",
    answer: "B Board focuses on sprint execution and reporting without the overhead of traditional enterprise trackers.",
  },
  {
    question: "Do you support Scrum/Kanban?",
    answer: "Yes. Plan sprints with guardrails and run card-first boards that support Scrum and Kanban rituals.",
  },
  {
    question: "How does standup work?",
    answer: "Use the Daily Standup module to post your update, view the team dashboard, and keep everyone aligned.",
  },
  {
    question: "Do you have AI summary?",
    answer: "Each standup generates an AI summary and presents it as formatted Markdown for quick review.",
  },
  {
    question: "Where is data stored?",
    answer: "Your data lives in our database with access controls designed for collaborative teams.",
  },
  {
    question: "How do I request features?",
    answer: "Reach out through the Contact Us form and include the use case you want to solve.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="mt-16 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">Questions teams ask.</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Quick answers about how B Board fits your process and keeps everyone in sync.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {faqs.map((item) => (
          <Card
            key={item.question}
            className="h-full border border-slate-200/80 bg-white/80 p-5 text-left shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/80"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{item.question}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

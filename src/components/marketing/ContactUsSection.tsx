import { ContactUsForm } from "./ContactUsForm";

export function ContactUsSection() {
  return (
    <section id="contact" className="mt-16 space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Contact</p>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Talk with the B Board team.</h2>
        <p className="mx-auto max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Share how your team plans, runs standups, and reports progress. We will reply from admin@bboard.site with next steps or a quick demo time.
        </p>
      </div>

      <ContactUsForm />
    </section>
  );
}

export const metadata = {
  title: 'Newsletter | The Engineering Journal',
  description: 'Subscribe to The Engineering Journal for engineering articles and tutorials.',
  alternates: {
    canonical: '/newsletter',
  },
};

export default function NewsletterPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 font-serif">
        Newsletter
      </h1>
      <p className="text-slate-600 dark:text-slate-300 leading-7">
        Get the latest engineering notes, tutorials, and project breakdowns from The Engineering
        Journal.
      </p>
    </section>
  );
}


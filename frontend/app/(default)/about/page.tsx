export const metadata = {
  title: 'About | The Engineering Journal',
  description:
    'About The Engineering Journal, a practical publication for engineering students and builders.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 font-serif">
        About The Engineering Journal
      </h1>
      <p className="text-slate-600 dark:text-slate-300 leading-7">
        The Engineering Journal publishes practical notes, tutorials, and project write-ups for
        students and engineers working across AI, full-stack development, and production software.
      </p>
    </section>
  );
}


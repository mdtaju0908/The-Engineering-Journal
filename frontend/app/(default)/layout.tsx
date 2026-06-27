import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function DefaultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <Navbar />
      <main className="flex-1 pt-24">
        {children}
      </main>
      <Footer />
    </div>
  );
}

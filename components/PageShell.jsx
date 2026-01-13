import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function PageShell({ children, mainClassName = "" }) {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]">
      <Navbar />
      <main id="main" className={`text-slate-900 ${mainClassName}`.trim()}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

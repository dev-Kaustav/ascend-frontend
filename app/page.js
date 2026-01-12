import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import Problem from "@/components/Problem";
import SectionReveal from "@/components/SectionReveal";
import Solution from "@/components/Solution";
import WhoItsFor from "@/components/WhoItsFor";
import WhyAscend from "@/components/WhyAscend";

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]">
      <Navbar />
      <main id="main" className="text-slate-900">
        <Hero />
        <SectionReveal>
          <Problem />
        </SectionReveal>
        <SectionReveal>
          <Solution />
        </SectionReveal>
        <SectionReveal>
          <HowItWorks />
        </SectionReveal>
        <SectionReveal>
          <WhyAscend />
        </SectionReveal>
        <SectionReveal>
          <WhoItsFor />
        </SectionReveal>
        <SectionReveal>
          <CTA />
        </SectionReveal>
        <SectionReveal>
          <ContactForm />
        </SectionReveal>
      </main>
      <Footer />
    </div>
  );
}

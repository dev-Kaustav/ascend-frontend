import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import MeetFounders from "@/components/MeetFounders";
import PageShell from "@/components/PageShell";
import Problem from "@/components/Problem";
import SectionReveal from "@/components/SectionReveal";
import Solution from "@/components/Solution";
import WhoItsFor from "@/components/WhoItsFor";
import WhyAscend from "@/components/WhyAscend";

export default function Home() {
  return (
    <PageShell>
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
        <MeetFounders />
      </SectionReveal>
      <SectionReveal>
        <CTA />
      </SectionReveal>
      <SectionReveal>
        <ContactForm />
      </SectionReveal>
    </PageShell>
  );
}

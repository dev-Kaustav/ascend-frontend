import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import HowItWorks from "@/components/HowItWorks";
import PageHero from "@/components/PageHero";
import PageShell from "@/components/PageShell";

const title = "How It Works";
const description =
  "See how Ascend connects distributors, captures retail orders, and delivers real-time GTM insights.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/how-it-works"
  },
  openGraph: {
    title,
    description,
    url: "/how-it-works"
  },
  twitter: {
    title,
    description
  }
};

export default function HowItWorksPage() {
  return (
    <PageShell>
      <PageHero
        title="A distribution flow built for scale"
        description="From distributor onboarding to real-time retail order capture, Ascend builds a single data spine for FMCG growth."
      />
      <HowItWorks />
      <CTA />
      <ContactForm />
    </PageShell>
  );
}

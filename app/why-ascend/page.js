import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import PageHero from "@/components/PageHero";
import PageShell from "@/components/PageShell";
import WhyAscend from "@/components/WhyAscend";

const title = "Why Ascend";
const description =
  "Learn why FMCG teams choose Ascend for offline-first execution and distribution intelligence.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/why-ascend"
  },
  openGraph: {
    title,
    description,
    url: "/why-ascend"
  },
  twitter: {
    title,
    description
  }
};

export default function WhyAscendPage() {
  return (
    <PageShell>
      <PageHero
        title="Built for Indian FMCG realities"
        description="Ascend blends distribution execution with intelligence designed for fragmented, high-velocity markets."
      />
      <WhyAscend />
      <CTA />
      <ContactForm />
    </PageShell>
  );
}

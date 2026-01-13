import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import PageHero from "@/components/PageHero";
import PageShell from "@/components/PageShell";
import WhoItsFor from "@/components/WhoItsFor";

const title = "Who It's For";
const description =
  "Ascend is built for FMCG brands, distributor networks, and sales teams that need distribution certainty.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/who-its-for"
  },
  openGraph: {
    title,
    description,
    url: "/who-its-for"
  },
  twitter: {
    title,
    description
  }
};

export default function WhoItsForPage() {
  return (
    <PageShell>
      <PageHero
        title="For FMCG brands and distributor networks"
        description="Ascend supports brand teams, sales leaders, and distributors who need faster expansion and deeper outlet visibility."
      />
      <WhoItsFor />
      <CTA />
      <ContactForm />
    </PageShell>
  );
}

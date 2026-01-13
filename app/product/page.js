import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import PageHero from "@/components/PageHero";
import PageShell from "@/components/PageShell";
import Solution from "@/components/Solution";

const title = "Product";
const description =
  "Explore Ascend's distribution intelligence platform for FMCG brands, from distributor access to outlet-level insights.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/product"
  },
  openGraph: {
    title,
    description,
    url: "/product"
  },
  twitter: {
    title,
    description
  }
};

export default function ProductPage() {
  return (
    <PageShell>
      <PageHero
        title="Distribution intelligence for FMCG expansion"
        description="Access curated distributor networks, digitize retail orders, and turn outlet data into GTM playbooks."
      />
      <Solution />
      <CTA />
      <ContactForm />
    </PageShell>
  );
}

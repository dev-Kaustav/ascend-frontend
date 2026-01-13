import ContactForm from "@/components/ContactForm";
import PageHero from "@/components/PageHero";
import PageShell from "@/components/PageShell";

const title = "Contact";
const description =
  "Connect with Ascend to discuss distribution coverage, outlet insights, and GTM intelligence.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/contact"
  },
  openGraph: {
    title,
    description,
    url: "/contact"
  },
  twitter: {
    title,
    description
  }
};

export default function ContactPage() {
  return (
    <PageShell>
      <PageHero
        title="Talk to the Ascend team"
        description="Tell us about your portfolio and expansion goals. Our team will respond with the right distribution plan."
        ctaLabel="Email Us"
        ctaHref="mailto:partnerships@ascendfoods.in"
      />
      <ContactForm />
    </PageShell>
  );
}

import BrandSection from "@/components/landing/BrandSection";
import BrandWall from "@/components/landing/BrandWall";
import ContrastSection from "@/components/landing/ContrastSection";
import Footer from "@/components/landing/Footer";
import FoundersSection from "@/components/landing/FoundersSection";
import FulfillmentSection from "@/components/landing/FulfillmentSection";
import HeroSection from "@/components/landing/HeroSection";
import LeadSection from "@/components/landing/LeadSection";
import Navbar from "@/components/landing/Navbar";
import RangeSection from "@/components/landing/RangeSection";

const siteUrl = "https://ascendfoods.in";
const landingUrl = `${siteUrl}/landing`;
const title = "Ascend: Snack Restocking in 60 Minutes";
const description =
  "Ascend restocks kirana and convenience stores across Gurugram and Delhi NCR with Bikaji, CRAX, Jabsons and MyUpchaar snacks, delivered from a nearby dark store in 60 minutes.";
const image = "/ascend-kirana-restock.webp";

// The storefront owns "/", so the marketing identity (title, copy, share image, canonical)
// lives here. Nested metadata objects replace the root's, hence complete OG and Twitter data.
export const metadata = {
  title: { absolute: title },
  description,
  keywords: [
    "B2B quick commerce",
    "kirana restocking",
    "dark store delivery",
    "Snacks B2B distribution",
    "retailer ordering",
    "India snacks distribution"
  ],
  alternates: { canonical: "/landing" },
  openGraph: {
    title,
    description,
    url: landingUrl,
    siteName: "Ascend Foods",
    type: "website",
    images: [
      {
        url: image,
        width: 1536,
        height: 1024,
        alt: "A kirana owner restocking everyday products with Ascend"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image]
  }
};

export default function Home() {
  return (
    <div className="ascend-marketing">
      <a className="marketing-skip" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <HeroSection />
        <BrandWall />
        <ContrastSection />
        <FulfillmentSection />
        <RangeSection />
        <BrandSection />
        <FoundersSection />
        <LeadSection />
      </main>
      <Footer />
    </div>
  );
}

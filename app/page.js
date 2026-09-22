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

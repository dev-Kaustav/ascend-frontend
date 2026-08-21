import BrandSection from "@/components/landing/BrandSection";
import BrandStrip from "@/components/landing/BrandStrip";
import ConversionSection from "@/components/landing/ConversionSection";
import Footer from "@/components/landing/Footer";
import FoundersSection from "@/components/landing/FoundersSection";
import FulfillmentSection from "@/components/landing/FulfillmentSection";
import HeroSection from "@/components/landing/HeroSection";
import MerchandiseSection from "@/components/landing/MerchandiseSection";
import Navbar from "@/components/landing/Navbar";
import RetailerSection from "@/components/landing/RetailerSection";

export default function Home() {
  return (
    <div className="ascend-marketing">
      <a className="marketing-skip" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <HeroSection />
        <MerchandiseSection />
        <FulfillmentSection />
        <RetailerSection />
        <BrandStrip />
        <BrandSection />
        <FoundersSection />
        <ConversionSection />
      </main>
      <Footer />
    </div>
  );
}

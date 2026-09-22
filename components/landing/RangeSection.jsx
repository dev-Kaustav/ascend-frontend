import Link from "next/link";
import { ArrowRight, Blend, Candy, CookingPot, Sparkles } from "lucide-react";

const categories = [
  {
    name: "Namkeen & Chana",
    body: "Bhujia, mixtures and chana from Bikaji, CRAX and Jabsons.",
    icon: CookingPot
  },
  {
    name: "Roasted & Kaju",
    body: "Roasted peanuts, kaju and dry roasted packs that move all day.",
    icon: Candy
  },
  {
    name: "Wellness Snacks",
    body: "MyUpchaar Ayurveda's better-for-you range for health-conscious shoppers.",
    icon: Sparkles
  },
  {
    name: "Impulse Counter Packs",
    body: "Small-ticket packs that keep the counter moving between big buys.",
    icon: Blend
  }
];

export default function RangeSection() {
  return (
    <section id="range" className="range-section marketing-band marketing-band--light">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">WHAT YOU CAN ORDER</p>
            <h2>Every snack your counter sells, on one order.</h2>
          </div>
          <p>
            Over 100 SKUs across four categories, chosen around what
            neighbourhood shoppers actually come back for.
          </p>
        </div>

        <ul className="merchandise-grid">
          {categories.map(({ name, body, icon: Icon }) => (
            <li key={name} className="merchandise-card">
              <div className="merchandise-card__icon" aria-hidden="true">
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <p className="merchandise-card__status">Fast movers</p>
              <h3>{name}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <div className="retailer-section__actions">
          <Link className="marketing-button marketing-button--primary" href="/#contact">
            Stock this range
            <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

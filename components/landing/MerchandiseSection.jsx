import { Blend, Candy, CookingPot, Sparkles } from "lucide-react";

const categories = [
  {
    name: "Namkeen & Chana",
    body: "Savoury namkeen and chana mixes from CRAX and JABSONS, the counter's steady sellers.",
    icon: CookingPot
  },
  {
    name: "Roasted & Kaju",
    body: "Roasted peanuts, kaju and dry roasted packs that move all day.",
    icon: Candy
  },
  {
    name: "Wellness Snacks",
    body: "MyUpchaar Ayurveda's better-for-you snack range for health-conscious shoppers.",
    icon: Sparkles
  },
  {
    name: "Impulse Counter Packs",
    body: "Small-ticket snack packs that keep the counter moving.",
    icon: Blend
  }
];

export default function MerchandiseSection() {
  return (
    <section id="merchandise" className="merchandise-section marketing-band marketing-band--light">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">FOCUSED ASSORTMENT</p>
            <h2>Fast movers, ready for your shelf.</h2>
          </div>
          <p>
            A practical range of everyday snack categories, selected around what
            neighbourhood shoppers come back for.
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
      </div>
    </section>
  );
}

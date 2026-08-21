import {
  Blend,
  Bubbles,
  Candy,
  CookingPot,
  CupSoda,
  Sparkles
} from "lucide-react";

const categories = [
  {
    name: "Snacks",
    body: "Counter-ready favourites for everyday cravings.",
    icon: Candy
  },
  {
    name: "Beverages",
    body: "Cold and ambient drinks that move all day.",
    icon: CupSoda
  },
  {
    name: "Staples",
    body: "Routine kitchen essentials for repeat baskets.",
    icon: CookingPot
  },
  {
    name: "Personal care",
    body: "Daily-use care products customers expect nearby.",
    icon: Sparkles
  },
  {
    name: "Home care",
    body: "Cleaning essentials for regular household demand.",
    icon: Bubbles
  },
  {
    name: "Impulse goods",
    body: "Small-ticket picks that keep the counter moving.",
    icon: Blend
  }
];

export default function MerchandiseSection() {
  return (
    <section id="merchandise" className="merchandise-section marketing-band">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">FOCUSED ASSORTMENT</p>
            <h2>Fast movers, ready for your shelf.</h2>
          </div>
          <p>
            A practical range of everyday FMCG categories, selected around what
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

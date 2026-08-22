import Link from "next/link";
import { ArrowRight, Clock3, Layers, ShieldCheck } from "lucide-react";

const values = [
  {
    title: "Full range, one order",
    body: "100+ curated FMCG SKUs across snacks, namkeen and everyday staples, sourced from onboarded brands.",
    icon: Layers
  },
  {
    title: "Picked from nearby stock",
    body: "Every order is picked and checked from inventory already positioned in your cluster.",
    icon: Clock3
  },
  {
    title: "Shelves that stay full",
    body: "Consistent fill rates on the fast movers that matter, run after run.",
    icon: ShieldCheck
  }
];

export default function RetailerSection() {
  return (
    <section id="retailers" className="retailer-section marketing-band">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">FOR RETAILERS</p>
            <h2>Stock what your counter actually sells.</h2>
          </div>
          <p>
            A focused FMCG range, picked from nearby inventory and restocked
            before the shelf runs empty.
          </p>
        </div>

        <p className="retailer-section__cue">
          <Clock3 aria-hidden="true" size={14} strokeWidth={2} />
          Restocked within 4 hours of order
        </p>

        <ul className="retailer-value-grid">
          {values.map(({ title, body, icon: Icon }) => (
            <li key={title} className="retailer-value-card">
              <div className="retailer-value-card__icon" aria-hidden="true">
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <h3>{title}</h3>
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

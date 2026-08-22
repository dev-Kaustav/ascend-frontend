import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";

const catalogue = [
  { brand: "Jabsons", name: "Tandoori Roasted Peanuts", pack: "23g", price: "8" },
  { brand: "Jabsons", name: "Black Pepper Roasted Peanuts", pack: "23g", price: "8" },
  { brand: "Jabsons", name: "Classic Salted Roasted Peanuts", pack: "27g", price: "8" },
  { brand: "Jabsons", name: "Hing Jeera Roasted Peanuts", pack: "23g", price: "8" },
  { brand: "Jabsons", name: "Hing Jeera Roasted Chana", pack: "25g", price: "8" },
  { brand: "Jabsons", name: "Green Peas Onion & Garlic Namkeen", pack: "22g", price: "8" },
  { brand: "Jabsons", name: "Tandoori Roasted Kaju", pack: "18g", price: "22.50" },
  { brand: "Jabsons", name: "Salted Roasted Kaju", pack: "35g", price: "48" }
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
            Live SKUs from Jabsons and Crax, priced per pack, picked from
            nearby inventory and restocked before the shelf runs empty.
          </p>
        </div>

        <p className="retailer-section__cue">
          <Clock3 aria-hidden="true" size={14} strokeWidth={2} />
          Restocked within 4 hours of order
        </p>

        <ul className="storefront-grid">
          {catalogue.map((item) => (
            <li key={item.name} className="storefront-card">
              <p className="storefront-card__brand">{item.brand.toUpperCase()}</p>
              <h3 className="storefront-card__name">{item.name}</h3>
              <div className="storefront-card__meta">
                <span className="storefront-card__pack">{item.pack}</span>
                <span className="storefront-card__price">₹{item.price}</span>
              </div>
            </li>
          ))}
          <li className="storefront-card storefront-card--brand">
            <p className="storefront-card__brand">ALSO LIVE</p>
            <h3 className="storefront-card__name">Crax namkeen range</h3>
            <p className="storefront-card__pack">Full assortment available on request</p>
          </li>
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

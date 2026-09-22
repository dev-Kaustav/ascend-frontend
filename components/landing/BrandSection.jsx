import Link from "next/link";
import { ArrowRight } from "lucide-react";

const benefits = [
  ["Reach doors a distributor skips", "Dense urban pockets get served store by store, including outlets outside the usual route."],
  ["Move stock in hours, not weeks", "Inventory sits in the cluster it sells in, so a case goes from dark store to shelf the same day."],
  ["See where your product actually sells", "Store-level replenishment shows which streets pull which SKUs, and where the next case should sit."]
];

export default function BrandSection() {
  return (
    <section id="brands" className="brand-section marketing-band marketing-band--light">
      <div className="brand-section__glow" aria-hidden="true" />
      <div className="marketing-container brand-section__inner">
        <div className="marketing-section-heading marketing-section-heading--brand brand-section__reveal">
          <div>
            <p className="marketing-eyebrow">FOR SNACK BRANDS</p>
            <h2>Put your packs on shelves your distributor never reaches.</h2>
          </div>
          <p>
            Ascend carries your range into neighbourhood retail and reports back
            what moved, store by store.
          </p>
        </div>

        <ol className="editorial-benefits editorial-benefits--brand">
          {benefits.map(([title, body], index) => (
            <li key={title} className="brand-section__reveal">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <Link className="marketing-inline-link brand-section__reveal" href="/#contact">
          Partner as a brand
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </section>
  );
}

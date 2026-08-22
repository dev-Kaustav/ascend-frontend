import { ArrowRight } from "lucide-react";

const proofBrands = ["CRAX", "JABSONS", "MyUpchaar Ayurveda"];

const benefits = [
  ["More neighbourhood doors", "Reach dense urban retail pockets store by store, including outlets outside the usual distributor rhythm."],
  ["Faster product movement", "Nearby inventory and short restock cycles help products return to active shelves with less delay."],
  ["Clearer demand visibility", "Store-level replenishment shows where products move and where the next case should be positioned."]
];

export default function BrandSection() {
  return (
    <section id="brands" className="brand-section marketing-band">
      <div className="brand-section__glow" aria-hidden="true" />
      <div className="marketing-container brand-section__inner">
        <div className="marketing-section-heading marketing-section-heading--brand brand-section__reveal">
          <div>
            <p className="marketing-eyebrow">FOR FMCG BRANDS</p>
            <h2>Reach more neighbourhood shelves.</h2>
          </div>
          <p>
            Put products closer to active demand with local execution and a
            clearer replenishment trail.
          </p>
        </div>

        <p className="brand-section__proof brand-section__reveal">
          Already live on Ascend
          <span>{proofBrands.join(" · ")}</span>
        </p>

        <ol className="editorial-benefits editorial-benefits--brand">
          {benefits.map(([title, body], index) => (
            <li key={title} className="brand-section__reveal">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <a
          className="marketing-inline-link brand-section__reveal"
          href="mailto:kaustav@ascendfoods.in?subject=Partner%20with%20Ascend"
        >
          Partner as a brand
          <ArrowRight aria-hidden="true" size={17} />
        </a>
      </div>
    </section>
  );
}

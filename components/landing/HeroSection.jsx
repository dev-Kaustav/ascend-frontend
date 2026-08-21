import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Clock3 } from "lucide-react";

const metrics = [
  ["3,000+", "active stores"],
  ["100+", "curated SKUs"],
  ["4 hours", "delivery window"],
  ["2", "dark stores live"]
];

export default function HeroSection() {
  return (
    <section className="marketing-hero" aria-labelledby="hero-title">
      <Image
        src="/ascend-kirana-restock.webp"
        alt="A kirana owner restocking everyday products from an orange delivery crate"
        fill
        priority
        sizes="100vw"
        className="marketing-hero__image"
      />
      <div className="marketing-hero__scrim" />

      <div className="marketing-container marketing-hero__content">
        <div className="marketing-hero__copy">
          <p className="marketing-eyebrow">ASCEND FOR RETAILERS</p>
          <h1 id="hero-title">FMCG restocking in four hours.</h1>
          <p className="marketing-hero__lead">
            Everyday fast movers, picked from nearby inventory and delivered
            before an empty shelf costs you the next sale.
          </p>
          <div className="marketing-hero__actions">
            <Link className="marketing-button marketing-button--primary" href="/#contact">
              Stock my store
              <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
            </Link>
            <Link className="marketing-button marketing-button--text" href="/#how-it-works">
              See how it works
              <ArrowDown aria-hidden="true" size={18} strokeWidth={2} />
            </Link>
          </div>
          <p className="marketing-speed-marker">
            <Clock3 aria-hidden="true" size={16} strokeWidth={2} />
            4-hour delivery window
          </p>
        </div>
      </div>

      <dl className="marketing-proof marketing-container" aria-label="Ascend operating proof">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <dd>{value}</dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

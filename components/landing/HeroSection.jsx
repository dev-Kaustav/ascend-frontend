import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, MapPin } from "lucide-react";

const metrics = [
  ["3,000+", "kirana stores served"],
  ["100+", "snack SKUs to order from"],
  ["60 min", "from order to shelf"],
  ["2", "dark stores live in NCR"]
];

export default function HeroSection() {
  return (
    <section className="marketing-hero" aria-labelledby="hero-title">
      <Image
        src="/ascend-kirana-restock.webp"
        alt="A kirana owner restocking everyday products from an orange delivery crate"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="marketing-hero__image"
      />
      <div className="marketing-hero__scrim" />

      <div className="marketing-container marketing-hero__content">
        <div className="marketing-hero__copy">
          <p className="marketing-eyebrow">WHOLESALE SNACK SUPPLY FOR KIRANA STORES</p>
          <h1 id="hero-title">
            Your distributor comes once a week.
            <br />
            <span className="hero-emphasis">We come in 60 minutes.</span>
          </h1>
          <p className="marketing-hero__lead">
            Ascend restocks neighbourhood shops with the snack brands their
            counter already sells. Order what you need, when you run out, and it
            arrives from a dark store in your own cluster the same hour.
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
            <MapPin aria-hidden="true" size={16} strokeWidth={2} />
            Live in Gurugram and Delhi NCR
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

const benefits = [
  ["Incremental urban sales", "Reach demand that traditional distributor routes often miss, especially smaller C-D category retailers."],
  ["Deeper cluster penetration", "Ascend services dense urban pockets store by store, opening retailers the brand may not have served before."],
  ["Visibility into replenishment", "Store-level movement shows where products are being pulled and where inventory should move next."]
];

export default function BrandSection() {
  return (
    <section id="brands" className="marketing-light-section brand-section">
      <div className="marketing-container">
        <div className="marketing-section-heading marketing-section-heading--brand">
          <div>
            <p className="marketing-kicker marketing-kicker--dark">
              <span /> For brands
            </p>
            <h2>Cleaner retail reach without losing shelf visibility.</h2>
          </div>
          <p>
            Ascend gives FMCG brands a faster route into urban convenience retail,
            with owned execution and a clearer view of demand.
          </p>
        </div>

        <ol className="editorial-benefits editorial-benefits--brand">
          {benefits.map(([title, body], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

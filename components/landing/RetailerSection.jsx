const benefits = [
  {
    number: "01",
    title: "More sales from the same shelf",
    body: "Fast replenishment helps retailers capture demand that would otherwise be lost when everyday products are unavailable."
  },
  {
    number: "02",
    title: "Fewer empty-shelf moments",
    body: "Ascend keeps high-churn products moving back to the store quickly, reducing the risk of stock-outs on routine items."
  },
  {
    number: "03",
    title: "A sharper fast-moving assortment",
    body: "The catalogue stays focused on high-churn FMCG SKUs, so the retailer can stock what local shoppers already pull from the shelf."
  }
];

export default function RetailerSection() {
  return (
    <section id="retailers" className="marketing-light-section retailer-section">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-kicker marketing-kicker--dark">
              <span /> For retailers
            </p>
            <h2>A calmer way to keep shelves available.</h2>
          </div>
          <p>
            Ascend gives kirana and convenience stores a faster, clearer way to
            replenish everyday FMCG inventory.
          </p>
        </div>

        <ol className="editorial-benefits">
          {benefits.map((benefit) => (
            <li key={benefit.number}>
              <span>{benefit.number}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

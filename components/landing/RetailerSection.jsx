const benefits = [
  {
    number: "01",
    title: "Keep the next sale on your shelf",
    body: "Fast replenishment brings everyday products back before regular shoppers have to look elsewhere."
  },
  {
    number: "02",
    title: "Restock around your store day",
    body: "A four-hour service window means replenishment can fit the demand you see today, not next week."
  },
  {
    number: "03",
    title: "Focus cash on fast movers",
    body: "A curated range keeps the basket practical, with less time spent searching through slow-moving assortment."
  }
];

export default function RetailerSection() {
  return (
    <section id="retailers" className="retailer-section marketing-band">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">FOR RETAILERS</p>
            <h2>Keep everyday demand available.</h2>
          </div>
          <p>
            Restock around the pace of your counter with nearby inventory and a
            focused range of high-churn essentials.
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

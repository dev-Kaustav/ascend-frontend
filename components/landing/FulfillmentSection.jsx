import { PackageCheck, ShoppingBasket, Truck } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Send your list",
    body: "Tell us what your shelf is short on. No route, no waiting for the salesman.",
    icon: ShoppingBasket
  },
  {
    number: "02",
    title: "We pick it nearby",
    body: "Your order is picked and checked at the dark store already stocked for your cluster.",
    icon: PackageCheck
  },
  {
    number: "03",
    title: "It reaches your counter",
    body: "The crate arrives inside the hour and goes straight onto the shelf.",
    icon: Truck
  }
];

export default function FulfillmentSection() {
  return (
    <section id="how-it-works" className="fulfillment-section marketing-band marketing-band--light">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">HOW IT WORKS</p>
            <h2>Three steps from empty shelf to full one.</h2>
          </div>
          <p>
            One route from what your store needs to what lands at your counter.
          </p>
        </div>

        <ol className="fulfillment-steps">
          {steps.map(({ number, title, body, icon: Icon }) => (
            <li key={number}>
              <div className="fulfillment-step__top">
                <span>{number}</span>
                <Icon aria-hidden="true" size={28} strokeWidth={1.7} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

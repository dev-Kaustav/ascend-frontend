import { PackageCheck, ShoppingBasket, Truck } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Choose your essentials",
    body: "Tell us which fast movers your store needs and where your shelves are running low.",
    icon: ShoppingBasket
  },
  {
    number: "02",
    title: "We pick nearby",
    body: "Your restock is picked and checked from inventory already positioned in your cluster.",
    icon: PackageCheck
  },
  {
    number: "03",
    title: "Shelves restock fast",
    body: "The order reaches your store inside the 60-minute service window, subject to cluster availability.",
    icon: Truck
  }
];

export default function FulfillmentSection() {
  return (
    <section id="how-it-works" className="fulfillment-section marketing-band marketing-band--light">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">ONE RESTOCK RUN</p>
            <h2>From restock list to shelf in one run.</h2>
          </div>
          <p>
            One clear route from what your store needs to what arrives at your
            counter, without waiting for the next distributor round.
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

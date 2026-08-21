import Image from "next/image";

const founders = [
  {
    name: "Pranshu Birla",
    role: "Founder & CEO",
    image: "/pranshu.jpg",
    focus: "Distribution and city operations",
    linkedin: "https://www.linkedin.com/in/pranshubirlapb/",
    body: "Leads Ascend's ground network, city execution, and the operating systems behind reliable FMCG distribution."
  },
  {
    name: "Kaustav Mukherjee",
    role: "Founder & CTO",
    image: "/kaustav.jpg",
    focus: "Technology and demand systems",
    linkedin: "https://www.linkedin.com/in/mkaustav/",
    body: "Builds the demand, routing, and operational software that connects every store signal to physical fulfillment."
  }
];

export default function FoundersSection() {
  return (
    <section id="founders" className="founders-section marketing-band">
      <div className="marketing-container">
        <div className="marketing-section-heading founders-section__heading">
          <div>
            <p className="marketing-eyebrow">THE OPERATORS BEHIND ASCEND</p>
            <h2>Meet the founders</h2>
          </div>
        </div>

        <div className="founder-grid">
          {founders.map((founder) => (
            <article key={founder.name} className="founder-card">
              <div className="founder-card__image">
                <Image
                  src={founder.image}
                  alt={founder.name}
                  fill
                  sizes="(max-width: 767px) 34vw, 180px"
                  className="object-cover"
                />
              </div>
              <div className="founder-card__copy">
                <p>{founder.focus}</p>
                <h3>{founder.name}</h3>
                <span>{founder.role}</span>
                <p>{founder.body}</p>
                <a href={founder.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

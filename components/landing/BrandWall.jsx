import Image from "next/image";

// The logo files in /public/brands are placeholder wordmarks. Drop the real artwork in at the
// same paths and this section picks it up with no code change.
const brands = [
  { name: "Bikaji", src: "/brands/bikaji.svg", width: 200 },
  { name: "CRAX", src: "/brands/crax.svg", width: 160 },
  { name: "Jabsons", src: "/brands/jabsons.svg", width: 200 },
  { name: "MyUpchaar Ayurveda", src: "/brands/myupchaar.svg", width: 230 },
  { name: "Lahori", src: "/brands/lahori.svg", width: 170 }
];

export default function BrandWall() {
  return (
    <section className="brand-wall marketing-band--light" aria-labelledby="brand-wall-title">
      <div className="marketing-container">
        <p className="brand-wall__title" id="brand-wall-title">
          The brands already moving through Ascend
        </p>
        <ul className="brand-wall__grid">
          {brands.map(({ name, src, width }) => (
            <li key={name}>
              <Image
                src={src}
                alt={name}
                width={width}
                height={56}
                className="brand-wall__logo"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

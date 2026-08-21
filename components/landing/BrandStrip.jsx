const brands = ["myupchaar", "Crax", "Jabsons", "Lahori Jeera"];

export default function BrandStrip() {
  return (
    <section className="brand-strip" aria-labelledby="brand-strip-title">
      <div className="brand-strip__header marketing-container">
        <p id="brand-strip-title">Brands served through Ascend</p>
      </div>
      <div className="marketing-container">
        <ul aria-label="Served brands" className="brand-strip__track">
          {brands.map((brand) => (
            <li className="brand-wordmark" data-brand={brand} key={brand}>
              {brand}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

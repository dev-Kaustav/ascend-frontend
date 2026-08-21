export default function ConversionSection() {
  return (
    <section id="contact" className="conversion-section">
      <div className="marketing-container conversion-section__inner">
        <p className="marketing-eyebrow">YOUR NEXT RESTOCK</p>
        <h2>Restock your store with Ascend.</h2>
        <p>
          Tell us where your store is. Our team will confirm service in your
          cluster.
        </p>
        <div className="conversion-section__actions">
          <a
            className="marketing-button marketing-button--primary"
            href="mailto:kaustav@ascendfoods.in?subject=Stock%20my%20store"
          >
            Stock my store <span aria-hidden="true">↗</span>
          </a>
          <a
            className="marketing-button marketing-button--secondary"
            href="mailto:kaustav@ascendfoods.in?subject=Partner%20with%20Ascend"
          >
            Partner as a brand
          </a>
        </div>
      </div>
    </section>
  );
}

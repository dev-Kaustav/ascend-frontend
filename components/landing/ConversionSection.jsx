export default function ConversionSection() {
  return (
    <section id="contact" className="conversion-section">
      <div className="marketing-container conversion-section__inner">
        <p className="marketing-kicker">
          <span /> Your next restock
        </p>
        <h2>Put the four-hour supply network behind your store.</h2>
        <p>
          Tell us where your store is and what you sell. The Ascend team will
          confirm availability in your cluster.
        </p>
        <div className="conversion-section__actions">
          <a
            className="marketing-button marketing-button--lime"
            href="mailto:kaustav@ascendfoods.in?subject=Stock%20my%20store"
          >
            Stock my store <span aria-hidden="true">↗</span>
          </a>
          <a
            className="marketing-button marketing-button--outline"
            href="mailto:kaustav@ascendfoods.in?subject=Partner%20with%20Ascend"
          >
            Partner as a brand
          </a>
        </div>
      </div>
    </section>
  );
}

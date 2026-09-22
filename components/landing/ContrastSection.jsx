const rows = [
  {
    label: "When you can order",
    old: "Whenever the salesman's route reaches your street",
    ascend: "Any hour your shelf runs low"
  },
  {
    label: "Time to shelf",
    old: "The next weekly visit",
    ascend: "60 minutes"
  },
  {
    label: "Where the stock sits",
    old: "A depot outside the city",
    ascend: "A dark store inside your cluster"
  },
  {
    label: "What you can order",
    old: "Whatever is on the truck that day",
    ascend: "The full range, every run"
  }
];

export default function ContrastSection() {
  return (
    <section id="why" className="contrast-section marketing-band marketing-band--light">
      <div className="marketing-container">
        <div className="marketing-section-heading">
          <div>
            <p className="marketing-eyebrow">THE PROBLEM WE REPLACE</p>
            <h2>An empty shelf should not have to wait for the weekly round.</h2>
          </div>
          <p>
            Traditional distribution moves on the truck&apos;s schedule. Ascend
            moves on yours.
          </p>
        </div>

        <table className="contrast-table">
          <caption className="sr-only">
            How ordering through a traditional distributor compares with ordering through Ascend
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">What is being compared</span>
              </th>
              <th scope="col">Your distributor</th>
              <th scope="col" className="contrast-table__ours">
                Ascend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, old, ascend }) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{old}</td>
                <td className="contrast-table__ours">{ascend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

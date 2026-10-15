export default function FieldStatusFilters({ value, onChange, driver = false }) {
  const statuses = driver
    ? [["READY_TO_SHIP", "Pickup"], ["OUT_FOR_DELIVERY", "On the road"], ["DELIVERED", "Delivered"], ["ALL", "All"], ["CANCELLED", "Cancelled"]]
    : [["ALL", "All orders"], ["PENDING", "Pending"], ["READY_TO_SHIP", "Ready"], ["OUT_FOR_DELIVERY", "On the road"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]];
  return (
    <div className="field-status-filters lg:hidden" role="group" aria-label="Filter orders by status">
      {statuses.map(([status, label]) => <button key={status} type="button" aria-pressed={status === value} onClick={() => onChange(status)}>{label}</button>)}
    </div>
  );
}

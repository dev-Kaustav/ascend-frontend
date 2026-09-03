// Human labels for the supplier fields a valid GST tax invoice requires. The list of
// which fields are missing is computed by the backend
// (ascend-backend/app/services/invoice.py::missing_company_invoice_fields) so the warning
// and the issuance path cannot drift apart; this only names them for a reader.
export const FIELD_LABELS = {
  legal_name: "Legal name",
  gstin: "GSTIN",
  state: "State",
  address_line1: "Address",
  pincode: "Pincode"
};

export function describeMissingFields(missingFields = []) {
  return missingFields.map((field) => FIELD_LABELS[field] || field).join(", ");
}

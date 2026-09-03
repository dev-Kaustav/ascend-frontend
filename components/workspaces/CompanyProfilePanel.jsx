"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { apiEndpoints, apiFetch } from "@/lib/api";
import { InputBar, SelectBar } from "@/components/ui/InputBars";
import { INDIAN_STATES } from "@/lib/states";
import { useToast } from "@/components/ui/ToastProvider";
import { FIELD_LABELS } from "@/lib/companyProfile";

const EMPTY_PROFILE = {
  legal_name: "",
  gstin: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  invoice_prefix: "ASC",
  invoice_footer: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_branch: ""
};

// Only the fields the API accepts. The response also carries id and the computed
// missing_invoice_fields, neither of which may be sent back on a PATCH.
const EDITABLE_FIELDS = Object.keys(EMPTY_PROFILE);

const LABEL_CLASSNAME = "text-xs uppercase tracking-widest text-slate-400";

export default function CompanyProfilePanel() {
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [missingFields, setMissingFields] = useState([]);
  const [paymentQrId, setPaymentQrId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();

  function applyResponse(response) {
    const next = { ...EMPTY_PROFILE };
    EDITABLE_FIELDS.forEach((field) => {
      next[field] = response?.[field] ?? "";
    });
    setForm(next);
    setMissingFields(response?.missing_invoice_fields || []);
    setPaymentQrId(response?.payment_qr_image_id ?? null);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(apiEndpoints.admin.companyProfile);
        if (!active) return;
        applyResponse(response);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err?.payload?.detail || err?.message || "Unable to load company profile.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {};
      EDITABLE_FIELDS.forEach((field) => {
        const value = typeof form[field] === "string" ? form[field].trim() : form[field];
        // The backend normalizes "" to null for state and defaults invoice_prefix, so
        // send blanks through as null rather than empty strings.
        payload[field] = value === "" ? null : value;
      });
      payload.legal_name = payload.legal_name || "Ascend Foods";
      payload.invoice_prefix = payload.invoice_prefix || "ASC";

      const response = await apiFetch(apiEndpoints.admin.companyProfile, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      applyResponse(response);
      notify("Company profile saved.");
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Unable to save company profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
        Loading company profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {missingFields.length ? (
        <div className="rounded-[1.5rem] border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">This profile is not ready to issue a tax invoice.</p>
          <p className="mt-2">
            Missing:{" "}
            <span className="font-semibold">
              {missingFields.map((field) => FIELD_LABELS[field] || field).join(", ")}
            </span>
            .
          </p>
          <p className="mt-2">
            These values are stamped onto every invoice at dispatch, and an issued invoice is
            immutable — it cannot be corrected afterwards. Fill them in before dispatching any
            order you intend to bill.
          </p>
        </div>
      ) : null}

      <SectionCard
        title="Company Profile"
        subtitle="The supplier details printed on every invoice. Stamped onto the invoice at dispatch."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-legal-name">
                Legal name
              </label>
              <InputBar
                id="cp-legal-name"
                value={form.legal_name}
                onChange={update("legal_name")}
                placeholder="Ascend Foods"
                className="mt-2"
              />
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-gstin">
                GSTIN
              </label>
              <InputBar
                id="cp-gstin"
                value={form.gstin}
                onChange={update("gstin")}
                placeholder="15-character GSTIN"
                className="mt-2 uppercase"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-address1">
                Address line 1
              </label>
              <InputBar id="cp-address1" value={form.address_line1} onChange={update("address_line1")} className="mt-2" />
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-address2">
                Address line 2
              </label>
              <InputBar id="cp-address2" value={form.address_line2} onChange={update("address_line2")} className="mt-2" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-city">
                City
              </label>
              <InputBar id="cp-city" value={form.city} onChange={update("city")} className="mt-2" />
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-state">
                State
              </label>
              <SelectBar id="cp-state" value={form.state || ""} onChange={update("state")} className="mt-2">
                <option value="">Select state</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </SelectBar>
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-pincode">
                Pincode
              </label>
              <InputBar id="cp-pincode" value={form.pincode} onChange={update("pincode")} className="mt-2" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-phone">
                Phone
              </label>
              <InputBar id="cp-phone" value={form.phone} onChange={update("phone")} className="mt-2" />
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-email">
                E-mail
              </label>
              <InputBar id="cp-email" type="email" value={form.email} onChange={update("email")} className="mt-2" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-prefix">
                Invoice prefix
              </label>
              <InputBar
                id="cp-prefix"
                value={form.invoice_prefix}
                onChange={update("invoice_prefix")}
                placeholder="ASC"
                className="mt-2 uppercase"
              />
              <p className="mt-2 text-xs text-slate-500">
                Leads every invoice number. Letters, digits, hyphen and slash only. Changing it does
                not renumber invoices already issued.
              </p>
            </div>
            <div>
              <label className={LABEL_CLASSNAME} htmlFor="cp-footer">
                Invoice footer
              </label>
              <InputBar
                id="cp-footer"
                value={form.invoice_footer}
                onChange={update("invoice_footer")}
                placeholder="Terms, bank details or a declaration"
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-200 pt-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Payment details</p>
              <p className="mt-1 text-xs text-slate-500">
                Printed on the invoice so retailers can pay. Frozen onto each invoice when it is
                issued — changing these affects future invoices only, never one already issued.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASSNAME} htmlFor="cp-bank-name">
                  Bank name
                </label>
                <InputBar id="cp-bank-name" value={form.bank_name} onChange={update("bank_name")} className="mt-2" />
              </div>
              <div>
                <label className={LABEL_CLASSNAME} htmlFor="cp-bank-account-name">
                  Account holder name
                </label>
                <InputBar
                  id="cp-bank-account-name"
                  value={form.bank_account_name}
                  onChange={update("bank_account_name")}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={LABEL_CLASSNAME} htmlFor="cp-bank-account-number">
                  Account number
                </label>
                <InputBar
                  id="cp-bank-account-number"
                  value={form.bank_account_number}
                  onChange={update("bank_account_number")}
                  className="mt-2"
                />
              </div>
              <div>
                <label className={LABEL_CLASSNAME} htmlFor="cp-bank-ifsc">
                  IFSC
                </label>
                <InputBar
                  id="cp-bank-ifsc"
                  value={form.bank_ifsc}
                  onChange={update("bank_ifsc")}
                  className="mt-2 uppercase"
                />
              </div>
              <div>
                <label className={LABEL_CLASSNAME} htmlFor="cp-bank-branch">
                  Branch
                </label>
                <InputBar id="cp-bank-branch" value={form.bank_branch} onChange={update("bank_branch")} className="mt-2" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {paymentQrId
                ? `Payment QR is set (image #${paymentQrId}) and prints beside these details. It is loaded by scripts/configure_company_profile.py, not from this form.`
                : "No payment QR is set. Load one with scripts/configure_company_profile.py --qr-image."}
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Phone, e-mail and footer are presentation-only: they are read live at render time, so
            editing them changes how existing invoices print. Everything else is snapshotted onto
            the invoice when it is issued and never changes afterwards.
          </p>

          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

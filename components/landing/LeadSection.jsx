"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

// Deliberately a plain fetch rather than lib/api.js: that helper carries the dashboard's token
// refresh and logs the user out on a 401, none of which belongs on a public marketing form.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const LEAD_TYPES = [
  { value: "RETAILER", label: "I run a shop" },
  { value: "BRAND", label: "I represent a brand" }
];

export default function LeadSection() {
  const [leadType, setLeadType] = useState("RETAILER");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const isRetailer = leadType === "RETAILER";

  async function onSubmit(event) {
    event.preventDefault();
    if (status === "submitting") return;

    const data = new FormData(event.currentTarget);
    const payload = {
      lead_type: leadType,
      name: (data.get("name") || "").trim(),
      mobile_number: (data.get("mobile_number") || "").trim(),
      pincode: (data.get("pincode") || "").trim() || null,
      note: (data.get("note") || "").trim() || null
    };

    if (!/^\d{10}$/.test(payload.mobile_number)) {
      setError("Enter a 10 digit mobile number.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setError("Could not send that. Please try again, or write to pranshu@ascendfoods.in.");
      setStatus("error");
    }
  }

  return (
    <section id="contact" className="lead-section marketing-band marketing-band--light">
      <div className="marketing-container lead-section__inner">
        <div className="lead-section__copy">
          <p className="marketing-eyebrow">GET STARTED</p>
          <h2>Tell us where your shop is.</h2>
          <p>
            Leave your number and pincode. We will call back to confirm whether
            your cluster is already on a delivery route, and put you on the next
            one if it is not.
          </p>
          <p className="lead-section__aside">
            Serving Gurugram and Delhi NCR. Prefer email?{" "}
            <a href="mailto:pranshu@ascendfoods.in">pranshu@ascendfoods.in</a>
          </p>
        </div>

        {status === "success" ? (
          <div className="lead-form lead-form--done" role="status">
            <div className="lead-form__tick" aria-hidden="true">
              <Check size={26} strokeWidth={2.4} />
            </div>
            <h3>Got it.</h3>
            <p>
              {isRetailer
                ? "We will call you to confirm service in your cluster."
                : "Our team will reach out about listing your range."}
            </p>
          </div>
        ) : (
          <form className="lead-form" onSubmit={onSubmit} noValidate>
            <fieldset className="lead-form__toggle">
              <legend className="sr-only">Who is getting in touch</legend>
              {LEAD_TYPES.map(({ value, label }) => (
                <label key={value} data-active={leadType === value}>
                  <input
                    type="radio"
                    name="lead_type"
                    value={value}
                    checked={leadType === value}
                    onChange={() => setLeadType(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <label className="lead-form__field">
              <span>{isRetailer ? "Shop name" : "Brand name"}</span>
              <input
                name="name"
                type="text"
                required
                maxLength={120}
                autoComplete="organization"
                placeholder={isRetailer ? "Sharma Kirana Store" : "Your brand"}
              />
            </label>

            <div className="lead-form__row">
              <label className="lead-form__field">
                <span>Mobile number</span>
                <input
                  name="mobile_number"
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  autoComplete="tel-national"
                  placeholder="10 digits"
                />
              </label>
              <label className="lead-form__field">
                <span>
                  Pincode <em>optional</em>
                </span>
                <input
                  name="pincode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="postal-code"
                  placeholder="122001"
                />
              </label>
            </div>

            <label className="lead-form__field">
              <span>
                Anything else <em>optional</em>
              </span>
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                placeholder={
                  isRetailer ? "What you usually run short on" : "Categories you want stocked"
                }
              />
            </label>

            {status === "error" && (
              <p className="lead-form__error" role="alert">
                {error}
              </p>
            )}

            <button
              className="marketing-button marketing-button--primary"
              type="submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Sending..." : "Request a callback"}
              <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

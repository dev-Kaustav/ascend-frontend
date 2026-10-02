"use client";

import { useRetailer } from "@/components/store/RetailerProvider";
import { formatAddressLines, headerAddressLabel } from "@/lib/store/maps.mjs";

// Account: who the invoices are billed to, and where deliveries can go. Bill to is the registered
// shop; Ship to is the saved delivery addresses. They are separate on purpose (D-22): choosing or
// editing a Ship to address never changes the registered shop, and past orders keep the address
// they were placed with because the server stores that snapshot on the order.

function Lines({ lines }) {
  return (
    <div className="store-account__lines">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
}

export default function AccountView() {
  const { readiness, status, me, addresses, selectedAddress, openAddresses, openSheet, requireRetailer, logout, refreshMe } = useRetailer();

  if (readiness === "loading") {
    return (
      <section className="store-state" aria-busy="true" aria-labelledby="store-account-title">
        <h1 id="store-account-title">Account</h1>
        <p role="status">Loading your account</p>
      </section>
    );
  }

  if (readiness === "anonymous") {
    return (
      <section className="store-state" aria-labelledby="store-account-title">
        <h1 id="store-account-title">Account</h1>
        <p>{status === "expired" ? "Your session ended. Log in again to see your account." : "Log in to see your account."}</p>
        <button type="button" className="store-button" onClick={() => requireRetailer(null)}>
          Log in or Sign up
        </button>
      </section>
    );
  }

  if (readiness === "error") {
    return (
      <section className="store-state" aria-labelledby="store-account-title">
        <h1 id="store-account-title">Account</h1>
        <p role="alert">We couldn&apos;t load your account.</p>
        <button type="button" className="store-button" onClick={refreshMe}>
          Try again
        </button>
      </section>
    );
  }

  if (readiness !== "ready") {
    return (
      <section className="store-state" aria-labelledby="store-account-title">
        <h1 id="store-account-title">Account</h1>
        <p>Finish setting up your shop to place orders.</p>
        <button type="button" className="store-button" onClick={() => openSheet("shop")}>
          Set up your shop
        </button>
      </section>
    );
  }

  const shop = me?.shop;
  const billTo = [
    shop?.address_line1,
    shop?.address_line2,
    [shop?.city, [shop?.state, shop?.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  ].filter(Boolean);

  return (
    <section className="store-account" aria-labelledby="store-account-title">
      <h1 id="store-account-title">Account</h1>

      <div className="store-account__card" aria-labelledby="store-account-bill">
        <h2 id="store-account-bill">Bill to</h2>
        <p className="store-account__name">{shop?.name}</p>
        {shop?.gst_number ? <p>GST number {shop.gst_number}</p> : null}
        <Lines lines={billTo} />
        <p className="store-hint">Your registered shop. Invoices are made out to it.</p>
      </div>

      <div className="store-account__card" aria-labelledby="store-account-ship">
        <h2 id="store-account-ship">Ship to</h2>
        {addresses.length === 0 ? (
          <p>Add a delivery address to place your order.</p>
        ) : (
          <ul className="store-account__addresses">
            {addresses.map((address) => {
              const selected = selectedAddress && String(selectedAddress.id) === String(address.id);
              return (
                <li key={address.id} data-selected={selected ? "true" : "false"}>
                  <p className="store-account__name">
                    {headerAddressLabel(address)}
                    {selected ? <span className="store-address-row__badge">Delivering here</span> : null}
                  </p>
                  <Lines lines={formatAddressLines(address)} />
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="store-button store-button--secondary" onClick={openAddresses}>
          {addresses.length === 0 ? "Add address" : "Change or add address"}
        </button>
      </div>

      <button type="button" className="store-link-button" onClick={logout}>
        Log out
      </button>
    </section>
  );
}

"use client";

import WorkspaceTabs from "@/components/layout/WorkspaceTabs";
import AccountingPanel from "@/components/workspaces/AccountingPanel";
import InvoicesPanel from "@/components/workspaces/InvoicesPanel";
import CreditNotesPanel from "@/components/workspaces/CreditNotesPanel";
import CashCollectionPanel from "@/components/workspaces/CashCollectionPanel";

export default function FinanceWorkspacePage() {
  const tabs = [
    {
      key: "overview",
      label: "Overview",
      description: "Accounting summary, payment status, and financial health at a glance.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <AccountingPanel />
    },
    {
      key: "invoices",
      label: "Invoices",
      description: "Invoice totals, payment state, and order-to-invoice tracking.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <InvoicesPanel />
    },
    {
      key: "credit-notes",
      label: "Credit Notes",
      description: "Issued credits and adjustments grouped with finance operations.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <CreditNotesPanel />
    },
    {
      key: "cash-collection",
      label: "Cash Collection",
      description: "Payment collection and receivables follow-through in one place.",
      roles: ["ADMIN", "ACCOUNTANT"],
      render: () => <CashCollectionPanel />
    }
  ];

  return (
    <WorkspaceTabs
      title="Finance"
      subtitle="Accounting, invoices, credits, and collections organized into a single finance workspace."
      tabs={tabs}
    />
  );
}

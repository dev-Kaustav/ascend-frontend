import AccountView from "@/components/store/AccountView";

// Private to the signed-in retailer: noindex, and nothing about the account is rendered on the
// server (the client reads the retailer session after hydration).
export const metadata = {
  title: { absolute: "Account | Ascend Foods" },
  robots: { index: false, follow: false }
};

export default function AccountPage() {
  return <AccountView />;
}

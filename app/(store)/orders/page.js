import { OrderHistory } from "@/components/store/OrderViews";
import { parseOrderPage } from "@/lib/store/orders.mjs";

// The retailer's own order history: private, noindex, and nothing about any order is rendered on
// the server (the client reads the retailer session after hydration and asks the store API with
// the retailer's own token). Next 16 hands searchParams over as a promise.
export const metadata = {
  title: { absolute: "Your orders | Ascend Foods" },
  robots: { index: false, follow: false }
};

export default async function OrdersPage({ searchParams }) {
  const page = parseOrderPage((await searchParams)?.page);
  return <OrderHistory page={page} />;
}

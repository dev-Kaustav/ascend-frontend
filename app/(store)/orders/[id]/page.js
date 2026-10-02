import { OrderDetail } from "@/components/store/OrderViews";
import { parseOrderId } from "@/lib/store/orders.mjs";

// One of the retailer's own orders: private, noindex, and a durable address (a reload or a shared
// link comes back here). ?placed=1 is where a confirmed order lands; the confirmation itself is
// read back from the server by the client, never taken from the URL. An id that is not a plain
// order number is shown as unavailable without asking the API anything.
export const metadata = {
  title: { absolute: "Order | Ascend Foods" },
  robots: { index: false, follow: false }
};

export default async function StoreOrderPage({ params, searchParams }) {
  const id = parseOrderId((await params).id);
  const placed = (await searchParams)?.placed;
  return <OrderDetail id={id} placed={(Array.isArray(placed) ? placed[0] : placed) === "1"} />;
}

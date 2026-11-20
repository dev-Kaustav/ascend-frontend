"use client";

import { useParams } from "next/navigation";
import OrderDesk from "@/components/orders/OrderDesk";
import OrderScreen from "@/components/orders/OrderScreen";
import { useAuth } from "@/components/auth/AuthProvider";
import useIsDesktop from "@/lib/hooks/useIsDesktop";
import { can } from "@/lib/policy";

// One order. At a desk the office roles get the dense order desk; everyone else, and every phone,
// gets the app screen. Only one of the two is mounted (useIsDesktop is null until the width is known).
export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params?.orderId;
  const { role } = useAuth();
  const isDesktop = useIsDesktop();

  if (isDesktop === null) return null;
  if (isDesktop && can(role, "orderDesk")) {
    return (
      <div className="mx-auto max-w-[880px]">
        <OrderDesk orderId={orderId} />
      </div>
    );
  }
  return <OrderScreen orderId={orderId} />;
}

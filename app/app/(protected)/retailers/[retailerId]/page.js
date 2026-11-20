"use client";

import { useParams } from "next/navigation";
import ShopScreen from "@/components/shops/ShopScreen";

export default function ShopPage() {
  const { retailerId } = useParams();
  return <ShopScreen shopId={retailerId} />;
}

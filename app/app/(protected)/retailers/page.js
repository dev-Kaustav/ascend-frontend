"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SegmentedTabs from "@/components/field/SegmentedTabs";
import BeatList from "@/components/shops/BeatList";
import RetailerList from "@/components/shops/RetailerList";
import RetailersWorkspace from "@/components/workspaces/RetailersWorkspace";
import OutstandingPanel from "@/components/workspaces/OutstandingPanel";
import WarehouseSelector from "@/components/ui/WarehouseSelector";
import { useAuth } from "@/components/auth/AuthProvider";
import useIsDesktop from "@/lib/hooks/useIsDesktop";
import { can } from "@/lib/policy";

// The shops. A phone gets the app list for every role; the office at a desk keeps the retailers
// workspace (directory, beats, coverage, outstanding). A salesman gets the app list at any width.
// On a phone the admin also gets the beats beside the shops (what each shop owes is on its own
// screen); the accountant, who has no beats, keeps the outstanding list there instead.
export default function RetailersPage() {
  const { role } = useAuth();
  const isDesktop = useIsDesktop();

  if (isDesktop === null) return null;
  if (isDesktop && can(role, "orderDesk")) return <RetailersWorkspace />;
  if (can(role, "manageRetailers")) return <ShopsWith second={["beats", "Beats"]} render={() => <BeatList />} />;
  if (can(role, "seeOutstanding")) return <ShopsWith second={["outstanding", "Outstanding"]} render={() => <Outstanding />} />;
  return <RetailerList />;
}

// Shops and one other view, switched in place. The view is in the URL (?view=), so the back arrow
// from a beat lands on the beats again.
function ShopsWith({ second, render }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === second[0] ? second[0] : "shops";
  const choose = (key) => router.replace(key === "shops" ? pathname : `${pathname}?view=${key}`, { scroll: false });
  return (
    <div className="space-y-3">
      <SegmentedTabs label="Retailers" tabs={[["shops", "Shops"], second]} value={view} onChange={choose} />
      {view === "shops" ? <RetailerList /> : render()}
    </div>
  );
}

function Outstanding() {
  const [warehouseId, setWarehouseId] = useState(null);
  return (
    <div className="space-y-4">
      <WarehouseSelector value={warehouseId} onChange={setWarehouseId} />
      <OutstandingPanel warehouseId={warehouseId} />
    </div>
  );
}

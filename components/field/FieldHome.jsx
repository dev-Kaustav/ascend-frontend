import Link from "next/link";
import dayjs from "dayjs";
import { ArrowRight, ClipboardList, MapPinned, Package, Plus, Store, Truck, UserRound } from "lucide-react";
import FieldOrderCard from "@/components/field/FieldOrderCard";

const HOME_CONFIG = {
  SALESMAN: {
    title: "Ready for your next order?",
    description: "Your retailers, orders and outlet routes. All in one place.",
    primary: { label: "Create an order", href: "/app/orders/new", icon: Plus },
    shortcuts: [
      { label: "My retailers", detail: "Your assigned outlets", href: "/app/retailers", icon: Store },
      { label: "Find outlets", detail: "Plan your next visit", href: "/app/outlet-finder", icon: MapPinned }
    ]
  },
  DRIVER: {
    title: "Let’s get deliveries moving.",
    description: "Pick up, deliver and record payments from your phone.",
    primary: { label: "Open my deliveries", href: "/app/orders", icon: Truck },
    shortcuts: [
      { label: "Routes & jobs", detail: "Your assigned outlets", href: "/app/outlet-finder", icon: MapPinned },
      { label: "My account", detail: "Profile and sign-in", href: "/app/profile", icon: UserRound }
    ]
  },
  WAREHOUSE_MANAGER: {
    title: "Keep dispatch moving.",
    description: "Prepare orders, assign drivers and stay on top of stock.",
    primary: { label: "Manage orders", href: "/app/orders", icon: Package },
    shortcuts: [
      { label: "Inventory", detail: "Check and receive stock", href: "/app/operations?tab=inventory", icon: Package },
      { label: "Drivers", detail: "Your delivery team", href: "/app/operations?tab=drivers", icon: Truck }
    ]
  }
};

export default function FieldHome({ role, metrics, orders = [] }) {
  const config = HOME_CONFIG[role];
  const PrimaryIcon = config.primary.icon;
  return (
    <div className="field-home lg:hidden">
      <section className="field-home-hero">
        <p className="text-sm">{dayjs().format("dddd, D MMMM")}</p>
        <h1 className="text-balance">{config.title}</h1>
        <p className="mt-3 text-sm">{config.description}</p>
        <Link href={config.primary.href} className="field-home-primary px-4"><PrimaryIcon className="size-5" aria-hidden="true" />{config.primary.label}<ArrowRight className="ml-auto size-5" aria-hidden="true" /></Link>
      </section>
      <section aria-label="Work overview" className="field-metrics">
        {metrics.map(({ label, value }) => <div key={label} className="field-metric"><strong>{value}</strong><span>{label}</span></div>)}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Your workspace</h2>
        <div className="field-shortcuts">
          {config.shortcuts.map(({ label, detail, href, icon: Icon }) => <Link key={href} href={href} className="field-shortcut"><Icon className="size-6 text-emerald-700" aria-hidden="true" /><strong>{label}</strong><span>{detail}</span></Link>)}
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/app/orders" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-700">View all<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        {orders.length ? <div className="space-y-3">{orders.slice(0, 3).map((order) => <FieldOrderCard key={order.id} order={order} />)}</div> : (
          <div className="field-empty"><ClipboardList className="mx-auto size-7 text-slate-400" aria-hidden="true" /><h3>No orders yet</h3><p>{role === "SALESMAN" ? "Create an order for one of your assigned retailers." : "Orders will appear here when they are assigned to your team."}</p><Link href={config.primary.href}>{config.primary.label}<ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link></div>
        )}
      </section>
    </div>
  );
}

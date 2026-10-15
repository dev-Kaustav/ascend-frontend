import { redirect } from "next/navigation";

export default function RetailerRequestsPage() {
  redirect("/app/retailers?tab=requests");
}

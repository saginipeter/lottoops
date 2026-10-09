import { redirect } from "next/navigation";

export default function LegacyInventoryPage() {
  redirect("/admin/inventory");
}

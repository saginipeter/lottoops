import { redirect } from "next/navigation";

export default function LegacyPlatformPage() {
  redirect("/platform-admin");
}

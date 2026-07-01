import { redirect } from "next/navigation";

// De losse leadslijst is samengevoegd met het dashboard.
export default function LeadsIndex() {
  redirect("/dashboard");
}

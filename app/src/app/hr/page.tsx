import { redirect } from "next/navigation";

/**
 * The HR home lives at `/` in HR workspace view (HrDashboard). This route
 * only exists so older links and the sidebar keep working.
 */
export default function HrHomePage() {
  redirect("/");
}

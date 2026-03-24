import { redirect } from "next/navigation";

/**
 * Root page – redirects to the login page.
 * Authenticated users will be redirected to the dashboard by middleware.
 */
export default function RootPage() {
  redirect("/login");
}

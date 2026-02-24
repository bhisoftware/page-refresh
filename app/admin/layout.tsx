import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminGate } from "./AdminGate";
import { AdminTabNav } from "@/components/admin/AdminTabNav";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    return <AdminGate />;
  }
  return (
    <>
      <AdminTabNav />
      {children}
    </>
  );
}

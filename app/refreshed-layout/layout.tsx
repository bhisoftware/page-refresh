import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Refreshed Layout — PageRefresh",
  robots: "noindex, nofollow",
};

export default function RefreshedLayoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

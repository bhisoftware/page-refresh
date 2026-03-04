import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AdminBackLinkProps {
  href: string;
  label: string;
}

export function AdminBackLink({ href, label }: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 sm:mb-8"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

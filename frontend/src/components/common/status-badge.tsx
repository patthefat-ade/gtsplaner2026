import { Badge } from "@/components/ui/badge";

type StatusVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

const statusConfig: Record<string, { label: string; variant: StatusVariant }> = {
  draft: { label: "Entwurf", variant: "secondary" },
  pending: { label: "Ausstehend", variant: "warning" },
  approved: { label: "Genehmigt", variant: "success" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
  cancelled: { label: "Storniert", variant: "secondary" },
  active: { label: "Aktiv", variant: "success" },
  inactive: { label: "Inaktiv", variant: "secondary" },
  income: { label: "Einnahme", variant: "success" },
  expense: { label: "Ausgabe", variant: "destructive" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    variant: "outline" as StatusVariant,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const roleLabels: Record<string, string> = {
    educator: "Pädagog:in",
    location_manager: "Standortleitung",
    admin: "Admin",
    super_admin: "Super Admin",
  };

  return (
    <Badge variant="outline">
      {roleLabels[role] || role}
    </Badge>
  );
}

"use client";

import { Link, useMatch } from "react-router";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useCanAccess } from "ra-core";

type PageMenuItemProps = {
  to: string;
  label: string;
  // Accept React component types (including lucide icons)
  icon?: React.ComponentType<unknown> | React.ElementType;
  requireAccess?: { resource: string; action?: string } | null;
  onClick?: () => void;
};

function AccessWrapper({ to, label, Icon, onClick, action, resource }: {
  to: string;
  label: string;
  Icon?: React.ComponentType<unknown> | React.ElementType;
  onClick?: () => void;
  action?: string;
  resource: string;
}) {
  const { isLoading, canAccess } = useCanAccess({ resource, action: action ?? "list" });
  const match = useMatch({ path: to, end: false });
  if (isLoading || !canAccess) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match}>
        <Link to={to} onClick={onClick}>
          {Icon ? <Icon /> : null}
          {label}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PageMenuItem({ to, label, icon: Icon, requireAccess, onClick }: PageMenuItemProps) {
  const match = useMatch({ path: to, end: false });

  // If no access requirement, render directly without calling ra-core hooks
  if (!requireAccess) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={!!match}>
          <Link to={to} onClick={onClick}>
            {Icon ? <Icon /> : null}
            {label}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Guarded version: call useCanAccess within a child rendered only when needed
  return (
    <AccessWrapper 
      to={to} 
      label={label} 
      Icon={Icon} 
      onClick={onClick} 
      resource={requireAccess.resource} 
      action={requireAccess.action}
    />
  );
}

import { createElement, useMemo, useState } from "react";
import {
  useCanAccess,
  useCreatePath,
  useGetResourceLabel,
  useHasDashboard,
  useResourceDefinitions,
  useTranslate,
} from "ra-core";
import { Link, useMatch } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  House,
  List,
  Shell,
  FileText,
  Settings,
  Users,
  Building2,
  Workflow,
  ChevronDown,
} from "lucide-react";

const CONFIG_RESOURCES = ["users", "proveedores", "tipos-operacion"] as const;
const OPERATIONS_RESOURCES = ["facturas"] as const;

type ResourceName = string;

export function AppSidebar() {
  const hasDashboard = useHasDashboard();
  const resources = useResourceDefinitions();
  const { openMobile, setOpenMobile } = useSidebar();

  const handleItemClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  const configResources = useMemo(
    () => CONFIG_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const operationsResources = useMemo(
    () => OPERATIONS_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const groupedNames = useMemo(
    () => new Set<ResourceName>([...configResources, ...operationsResources]),
    [configResources, operationsResources],
  );
  const otherResources = useMemo(
    () =>
      Object.keys(resources)
        .filter((name) => resources[name].hasList)
        .filter((name) => !groupedNames.has(name)),
    [resources, groupedNames],
  );

  const [configOpen, setConfigOpen] = useState(true);
  const [operationsOpen, setOperationsOpen] = useState(true);

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                <Shell className="!size-5" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasDashboard ? (
                <DashboardMenuItem onClick={handleItemClick} />
              ) : null}

              {operationsResources.length > 0 ? (
                <GroupMenuItem
                  label="Operaciones"
                  icon={FileText}
                  isOpen={operationsOpen}
                  onToggle={() => setOperationsOpen((open) => !open)}
                >
                  {operationsResources.map((name) => (
                    <ResourceSubMenuItem
                      key={name}
                      name={name}
                      onClick={handleItemClick}
                    />
                  ))}
                </GroupMenuItem>
              ) : null}

              {configResources.length > 0 ? (
                <GroupMenuItem
                  label="Configuración"
                  icon={Settings}
                  isOpen={configOpen}
                  onToggle={() => setConfigOpen((open) => !open)}
                >
                  {configResources.map((name) => (
                    <ResourceSubMenuItem
                      key={name}
                      name={name}
                      onClick={handleItemClick}
                    />
                  ))}
                </GroupMenuItem>
              ) : null}

              {otherResources.map((name) => (
                <ResourceMenuItem
                  key={name}
                  name={name}
                  onClick={handleItemClick}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

export const DashboardMenuItem = ({ onClick }: { onClick?: () => void }) => {
  const translate = useTranslate();
  const label = translate("ra.page.dashboard", {
    _: "Dashboard",
  });
  const match = useMatch({ path: "/", end: true });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match}>
        <Link to="/" onClick={onClick}>
          <House />
          {label}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const GROUP_ICONS: Record<string, React.ComponentType> = {
  users: Users,
  proveedores: Building2,
  "tipos-operacion": Workflow,
  facturas: FileText,
};

export const ResourceMenuItem = ({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) => {
  const { canAccess, isPending } = useCanAccess({
    resource: name,
    action: "list",
  });
  const resources = useResourceDefinitions();
  const getResourceLabel = useGetResourceLabel();
  const createPath = useCreatePath();
  const to = createPath({
    resource: name,
    type: "list",
  });
  const match = useMatch({ path: to, end: false });

  if (isPending) {
    return <Skeleton className="h-8 w-full" />;
  }

  if (!resources || !resources[name] || !canAccess) return null;

  const Icon = resources[name].icon ?? GROUP_ICONS[name] ?? List;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match}>
        <Link to={to} state={{ _scrollToTop: true }} onClick={onClick}>
          {createElement(Icon)}
          {getResourceLabel(name, 2)}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const GroupMenuItem = ({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ComponentType;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      type="button"
      onClick={onToggle}
      className="justify-between"
      isActive={isOpen}
    >
      <span className="flex items-center gap-2">
        {createElement(Icon)}
        {label}
      </span>
      <ChevronDown
        className={`size-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
      />
    </SidebarMenuButton>
    {isOpen ? <SidebarMenuSub>{children}</SidebarMenuSub> : null}
  </SidebarMenuItem>
);

const ResourceSubMenuItem = ({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) => {
  const { canAccess, isPending } = useCanAccess({
    resource: name,
    action: "list",
  });
  const resources = useResourceDefinitions();
  const getResourceLabel = useGetResourceLabel();
  const createPath = useCreatePath();
  const to = createPath({
    resource: name,
    type: "list",
  });
  const match = useMatch({ path: to, end: false });

  if (isPending) {
    return (
      <SidebarMenuSubItem>
        <Skeleton className="h-6 w-full" />
      </SidebarMenuSubItem>
    );
  }

  if (!resources || !resources[name] || !canAccess) return null;

  const Icon = resources[name].icon ?? GROUP_ICONS[name] ?? List;

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={!!match} size="sm">
        <Link to={to} state={{ _scrollToTop: true }} onClick={onClick}>
          {createElement(Icon)}
          <span>{getResourceLabel(name, 2)}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};






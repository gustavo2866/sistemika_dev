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
  Home,
  Package,
  ClipboardList,
  Kanban,
  Truck,
  BarChart3,
  ShoppingCart,
  ClipboardCheck,
  Wallet
} from "lucide-react";

const CONSTRUCTORA_RESOURCES = ["proyectos", "solicitudes", "recepciones", "dashboard-proyectos", "tarjas"] as const;
const OPERATIONS_RESOURCES = ["propiedades", "solicitudes"] as const;
const ADMIN_RESOURCES = ["facturas", "proveedores", "articulos", "orden-compra", "nominas"] as const;
const CONFIG_RESOURCES = ["users", "tipos-operacion", "metodos-pago", "tipos-comprobante"] as const;

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

  const constructoraResources = useMemo(
    () => CONSTRUCTORA_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const operationsResources = useMemo(
    () => OPERATIONS_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const adminResources = useMemo(
    () => ADMIN_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const configResources = useMemo(
    () => CONFIG_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const groupedNames = useMemo(
    () => new Set<ResourceName>([...constructoraResources, ...operationsResources, ...adminResources, ...configResources]),
    [constructoraResources, operationsResources, adminResources, configResources],
  );
  const otherResources = useMemo(
    () =>
      Object.keys(resources)
        .filter((name) => resources[name].hasList)
        .filter((name) => !groupedNames.has(name)),
    [resources, groupedNames],
  );

  const [constructoraOpen, setConstructoraOpen] = useState(true);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

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
                <span className="text-base font-semibold">WCL</span>
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

              {constructoraResources.length > 0 ? (
                <GroupMenuItem
                  label="Constructora"
                  icon={Building2}
                  isOpen={constructoraOpen}
                  onToggle={() => setConstructoraOpen((open) => !open)}
                >
                  {constructoraResources.map((name) => (
                    <ResourceSubMenuItem
                      key={name}
                      name={name}
                      onClick={handleItemClick}
                    />
                  ))}
                </GroupMenuItem>
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

              {adminResources.length > 0 ? (
                <GroupMenuItem
                  label="Administración"
                  icon={Building2}
                  isOpen={adminOpen}
                  onToggle={() => setAdminOpen((open) => !open)}
                >
                  {adminResources.map((name) => (
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
  "metodos-pago": FileText,
  proyectos: Kanban,
  propiedades: Home,
  articulos: Package,
  facturas: FileText,
  solicitudes: ClipboardList,
  recepciones: Truck,
  "dashboard-proyectos": BarChart3,
  "orden-compra": ShoppingCart,
  tarjas: ClipboardCheck,
  nominas: Wallet,
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






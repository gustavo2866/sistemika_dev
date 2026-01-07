import { createElement, useMemo, useState, type ComponentType } from "react";
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
  Building,
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
  Wallet,
  NotebookPen,
  FileStack,
  Handshake,
  LayoutGrid,
  Mail,
  MessageCircle,
  Calculator,
} from "lucide-react";

const CONSTRUCTORA_RESOURCES = ["proyectos", "recepciones", "dashboard-proyectos", "tarjas", "parte-diario"] as const;
const OPERATIONS_RESOURCES = ["propiedades", "solicitudes", "emprendimientos", "vacancias", "dashboard-vacancias", "tipos-propiedad"] as const;
const ADMIN_RESOURCES = ["facturas", "proveedores", "articulos", "orden-compra", "nominas", "centros-costo"] as const;
const CONFIG_RESOURCES = ["users", "departamentos", "tipos-operacion", "tipos-solicitud", "metodos-pago", "tipos-comprobante"] as const;
const CRM_RESOURCES = [
  "crm/eventos",
  "crm/oportunidades",
  "crm/contactos",
  "dashboard-crm",
] as const;
const CRM_CUSTOM_LINKS: Array<{
  label: string;
  to: string;
  icon: ComponentType;
  position: "top" | "bottom";
}> = [
  { label: "CRM Chat", to: "/crm/chat", icon: MessageCircle, position: "top" },
  { label: "CRM Panel", to: "/crm/panel", icon: LayoutGrid, position: "top" },
  { label: "Calculadora Financiera", to: "/calculadora-financiera", icon: Calculator, position: "top" },
  { label: "CRM Mensajes", to: "/crm/mensajes", icon: Mail, position: "bottom" },
  { label: "Setup", to: "/crm/setup", icon: Settings, position: "bottom" },
] as const;
const CRM_TOP_CUSTOM_LINKS = CRM_CUSTOM_LINKS.filter((link) => link.position === "top");
const CRM_BOTTOM_CUSTOM_LINKS = CRM_CUSTOM_LINKS.filter((link) => link.position === "bottom");
const CRM_CATALOG_RESOURCES = [
  "crm/catalogos/tipos-operacion",
  "crm/catalogos/motivos-perdida",
  "crm/catalogos/condiciones-pago",
  "crm/catalogos/tipos-evento",
  "crm/catalogos/motivos-evento",
  "monedas",
  "crm/catalogos/monedas",
  "crm/cotizaciones",
] as const;
const HIDDEN_RESOURCES = [
  "crm/catalogos/respuestas",
  "crm/chat",
  "crm/mensajes",
] as const;

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

  const crmResources = useMemo(
    () => CRM_RESOURCES.filter((name) => resources[name]?.hasList),
    [resources],
  );

  const groupedNames = useMemo(
    () =>
      new Set<ResourceName>([
        ...constructoraResources,
        ...operationsResources,
        ...adminResources,
        ...configResources,
        ...crmResources,
        ...CRM_CATALOG_RESOURCES,
      ]),
    [
      constructoraResources,
      operationsResources,
      adminResources,
      configResources,
      crmResources,
    ],
  );
  const otherResources = useMemo(
    () =>
      Object.keys(resources)
        .filter((name) => resources[name].hasList)
        .filter((name) => !groupedNames.has(name))
        .filter((name) => !HIDDEN_RESOURCES.includes(name)),
    [resources, groupedNames],
  );

  const [constructoraOpen, setConstructoraOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [crmOpen, setCrmOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

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

              {crmResources.length > 0 || CRM_CUSTOM_LINKS.length > 0 ? (
                <GroupMenuItem
                  label="CRM"
                  icon={Handshake}
                  isOpen={crmOpen}
                  onToggle={() => setCrmOpen((open) => !open)}
                >
                  {CRM_TOP_CUSTOM_LINKS.map((link) => (
                    <SidebarCustomMenuItem
                      key={link.to}
                      label={link.label}
                      to={link.to}
                      icon={link.icon}
                      onClick={handleItemClick}
                    />
                  ))}
                  {crmResources.map((name) => (
                    <ResourceSubMenuItem
                      key={name}
                      name={name}
                      onClick={handleItemClick}
                    />
                  ))}
                  {CRM_BOTTOM_CUSTOM_LINKS.map((link) => (
                    <SidebarCustomMenuItem
                      key={link.to}
                      label={link.label}
                      to={link.to}
                      icon={link.icon}
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
  departamentos: Building,
  "tipos-solicitud": FileStack,
  proveedores: Building2,
  "tipos-propiedad": Building,
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
  "parte-diario": NotebookPen,
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

const SidebarCustomMenuItem = ({
  label,
  to,
  icon,
  onClick,
}: {
  label: string;
  to: string;
  icon?: ComponentType;
  onClick?: () => void;
}) => {
  const match = useMatch({ path: to, end: false });
  const IconComponent = icon ?? Settings;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={!!match} size="sm">
        <Link to={to} state={{ _scrollToTop: true }} onClick={onClick}>
          {createElement(IconComponent)}
          <span>{label}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
};







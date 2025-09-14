"use client"

import { createElement } from "react";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  House, 
  List, 
  Shell, 
  ChevronRight,
  TestTube,
  FileText,
  Settings,
  Upload,
  Users,
  Building,
  Receipt
} from "lucide-react";

export function AppSidebar() {
  const hasDashboard = useHasDashboard();
  const { openMobile, setOpenMobile } = useSidebar();
  const handleClick = () => {
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  // Agrupar recursos por categorías
  const testResources = ["proveedores", "tipos-operacion"];
  const facturaResources = ["facturas"];
  const adminResources = ["users", "items", "paises", "tareas"];

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
                <span className="text-base font-semibold">SAK Invoice</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Dashboard */}
        {hasDashboard && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <DashboardMenuItem onClick={handleClick} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sección Test */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <TestTube className="mr-2 h-4 w-4" />
                Test
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Factura Test */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link to="/factura-test" onClick={handleClick}>
                        <Upload />
                        Factura Test
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* Recursos de Test */}
                  {testResources.map((name) => (
                    <ResourceMenuItem
                      key={name}
                      name={name}
                      onClick={handleClick}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Sección Facturas */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <FileText className="mr-2 h-4 w-4" />
                Facturas
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {facturaResources.map((name) => (
                    <ResourceMenuItem
                      key={name}
                      name={name}
                      onClick={handleClick}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Sección Configuración */}
        <Collapsible className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminResources.map((name) => (
                    <ResourceMenuItem
                      key={name}
                      name={name}
                      onClick={handleClick}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
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

  // Verificar si el recurso existe después de los hooks
  if (!resources || !resources[name] || !canAccess) {
    return null;
  }

  // Iconos específicos para cada recurso
  const getResourceIcon = (resourceName: string) => {
    switch (resourceName) {
      case "proveedores":
        return Users;
      case "tipos-operacion":
        return Building;
      case "facturas":
        return Receipt;
      case "users":
        return Users;
      case "items":
        return List;
      case "paises":
        return Building;
      case "tareas":
        return FileText;
      default:
        return List;
    }
  };

  const IconComponent = getResourceIcon(name);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match}>
        <Link to={to} state={{ _scrollToTop: true }} onClick={onClick}>
          {resources[name].icon ? (
            createElement(resources[name].icon)
          ) : (
            <IconComponent />
          )}
          {getResourceLabel(name, 2)}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

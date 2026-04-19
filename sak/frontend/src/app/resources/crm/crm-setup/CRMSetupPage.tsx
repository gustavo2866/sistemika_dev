"use client";

import type { ComponentType } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ResourceContextProvider, useCreatePath } from "ra-core";
import { ChevronDown } from "lucide-react";

import {
  SetupContentHeader,
  SetupContentPanel,
  SetupEmptyState,
  SetupLayout,
  type SetupCreateComponentProps,
  type SetupCustomComponentProps,
  type SetupEditComponentProps,
  type SetupListComponentProps,
  type SetupItem,
  type SetupView,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { CRM_SETUP_ITEMS, getCRMSetupItem } from "./crmSetupRegistry";

type CRMSetupMenuItem = {
  key: string;
  label: string;
};

type CRMSetupGroup = {
  key: string;
  label: string;
  items: CRMSetupMenuItem[];
};

const setupBasePath = "/crm/setup";

const CRM_SETUP_GROUPS: CRMSetupGroup[] = [
  {
    key: "oportunidades",
    label: "Oportunidades",
    items: [
      { key: "tipos-operacion", label: "Tipo de operacion" },
      { key: "motivos-perdida", label: "Motivos de perdida" },
      { key: "tipos-contacto", label: "Tipos de contacto" },
    ],
  },
  {
    key: "cotizacion",
    label: "Cotizacion",
    items: [
      { key: "condiciones-pago", label: "Condiciones de pago" },
      { key: "monedas", label: "Moneda" },
    ],
  },
  {
    key: "eventos",
    label: "Eventos",
    items: [
      { key: "tipos-evento", label: "Tipos de evento" },
      { key: "motivos-evento", label: "Motivos de evento" },
    ],
  },
  {
    key: "chat",
    label: "Chat",
    items: [
      { key: "celulares", label: "Celulares" },
      { key: "agente-chat", label: "Agentes" },
      { key: "respuestas", label: "Respuestas" },
    ],
  },
];

const getSetupItemPath = (item: SetupItem) => `${setupBasePath}/${item.key}`;

const getSetupViewPath = (
  item: SetupItem,
  view: SetupView,
  recordId?: string | number | null,
) => {
  if (view === "create") return `${getSetupItemPath(item)}/create`;
  if (view === "edit" && recordId != null) {
    return `${getSetupItemPath(item)}/edit/${recordId}`;
  }
  return getSetupItemPath(item);
};

const getSetupRouteState = (pathname: string) => {
  const relativePath = pathname.startsWith(setupBasePath)
    ? pathname.slice(setupBasePath.length)
    : "";
  const segments = relativePath.split("/").filter(Boolean);
  const selectedKey = segments[0] ?? null;
  const currentView: SetupView =
    segments[1] === "create" ? "create" : segments[1] === "edit" ? "edit" : "list";
  const recordId = currentView === "edit" ? segments[2] ?? null : null;
  return { selectedKey, currentView, recordId };
};

const getSetupGroupKeyByItem = (itemKey?: string | null) =>
  CRM_SETUP_GROUPS.find((group) =>
    group.items.some((item) => item.key === itemKey),
  )?.key ?? null;

const CRMSetupExternalResource = ({
  label,
  description,
  to,
}: {
  label: string;
  description?: string;
  to: string;
}) => (
  <SetupEmptyState
    title={label}
    description={
      description ??
      "Este parametro se administra fuera del setup CRM, pero se mantiene accesible desde aqui."
    }
    action={
      <Button asChild variant="secondary" size="sm">
        <Link to={to}>Abrir modulo</Link>
      </Button>
    }
  />
);

const CRMSetupOptionsMenu = ({
  groups,
  currentKey,
}: {
  groups: CRMSetupGroup[];
  currentKey?: string | null;
}) => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Opciones
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {groups.map((group, groupIndex) => (
          <div key={group.key}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.items.map((groupItem) => {
              const item = getCRMSetupItem(groupItem.key);
              if (!item) return null;
              const isActive = item.key === currentKey;

              return (
                <DropdownMenuItem
                  key={item.key}
                  className={cn(
                    "py-2 text-sm",
                    isActive && "bg-accent font-medium text-accent-foreground",
                  )}
                  onSelect={() => navigate(getSetupItemPath(item))}
                >
                  {groupItem.label}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const CRMSetupDesktopGroupMenu = ({
  groups,
  currentGroupKey,
  currentItemKey,
}: {
  groups: CRMSetupGroup[];
  currentGroupKey?: string | null;
  currentItemKey?: string | null;
}) => (
  <div className="hidden md:flex md:flex-wrap md:items-center md:gap-1 rounded-xl border border-border/70 bg-muted/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
    {groups.map((group) => {
      const isActiveGroup = group.key === currentGroupKey;

      return (
        <DropdownMenu key={group.key}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 rounded-lg px-3.5 text-[13px] font-medium transition-all",
                isActiveGroup
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <span>{group.label}</span>
              <ChevronDown className="ml-1.5 size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {group.items.map((groupItem) => {
              const item = getCRMSetupItem(groupItem.key);
              if (!item) return null;
              const isActiveItem = item.key === currentItemKey;

              return (
                <DropdownMenuItem
                  key={item.key}
                  className={cn(
                    "py-2 text-sm",
                    isActiveItem && "bg-accent font-medium text-accent-foreground",
                  )}
                  asChild
                >
                  <Link to={getSetupItemPath(item)}>{groupItem.label}</Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    })}
  </div>
);

const CRMSetupContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (item.customComponent) {
    const CustomComponent = item.customComponent as ComponentType<SetupCustomComponentProps>;
    return <CustomComponent embedded />;
  }

  if (!item.resource) return null;

  const listPath = getSetupViewPath(item, "list");
  const createPath = getSetupViewPath(item, "create");
  const ListComponent = item.listComponent as ComponentType<SetupListComponentProps> | undefined;
  const CreateComponent = item.createComponent as ComponentType<SetupCreateComponentProps> | undefined;
  const EditComponent = item.editComponent as ComponentType<SetupEditComponentProps> | undefined;

  if (view === "create") {
    if (!CreateComponent) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <CreateComponent redirect={listPath} />
      </ResourceContextProvider>
    );
  }

  if (view === "edit") {
    if (!EditComponent || !recordId) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <EditComponent id={recordId} redirect={listPath} />
      </ResourceContextProvider>
    );
  }

  if (!ListComponent) return null;

  return (
    <ResourceContextProvider value={item.resource}>
      <ListComponent
        rowClick={(id: string | number) => getSetupViewPath(item, "edit", id)}
        createTo={createPath}
      />
    </ResourceContextProvider>
  );
};

export const CRMSetupPage = () => {
  const location = useLocation();
  const createPath = useCreatePath();
  const { selectedKey, currentView, recordId } = getSetupRouteState(location.pathname);
  const selectedItem = getCRMSetupItem(selectedKey);
  const defaultItem = CRM_SETUP_ITEMS[0] ?? null;
  const selectedGroupKey = getSetupGroupKeyByItem(selectedItem?.key ?? null);

  if (!defaultItem) {
    return (
      <div className="max-w-5xl px-2 py-3 sm:p-6">
        <SetupEmptyState
          title="Setup"
          description="No hay opciones configuradas para este setup."
        />
      </div>
    );
  }

  if (!selectedItem) {
    return <Navigate to={getSetupItemPath(defaultItem)} replace />;
  }

  const externalResourcePath = selectedItem.externalResource
    ? createPath({
        resource: selectedItem.externalResource,
        type: "list",
      })
    : null;

  return (
    <div className="max-w-5xl px-2 py-3 sm:p-6">
      <SetupLayout
        header={
          <SetupContentHeader
            eyebrowLabel="CRM / Setup"
            title={false}
            actionsPlacement="inline"
            contentClassName="px-2.5 py-2.5 sm:px-4 sm:py-3"
            actionsClassName="w-full px-2.5 pb-3 sm:px-4"
            eyebrowClassName="text-[9px] tracking-[0.16em]"
            actions={
              <div className="space-y-2">
                <div className="md:hidden">
                  <CRMSetupOptionsMenu
                    groups={CRM_SETUP_GROUPS}
                    currentKey={selectedItem.key}
                  />
                </div>
                <CRMSetupDesktopGroupMenu
                  groups={CRM_SETUP_GROUPS}
                  currentGroupKey={selectedGroupKey}
                  currentItemKey={selectedItem.key}
                />
              </div>
            }
          />
        }
        content={
          <SetupContentPanel className="px-2.5 py-4 sm:px-4 sm:py-5">
            {selectedItem.externalResource && externalResourcePath ? (
              <CRMSetupExternalResource
                label={selectedItem.label}
                description={selectedItem.description}
                to={externalResourcePath}
              />
            ) : (
              <CRMSetupContent
                item={selectedItem}
                view={currentView}
                recordId={recordId}
              />
            )}
          </SetupContentPanel>
        }
      />
    </div>
  );
};

export default CRMSetupPage;

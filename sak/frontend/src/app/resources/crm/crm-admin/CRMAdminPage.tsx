"use client";

import type { ComponentType } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ResourceContextProvider, useCreatePath } from "ra-core";

import {
  SetupContentHeader,
  SetupContentPanel,
  SetupEmptyState,
  SetupLayout,
  SetupSectionNav,
  type SetupCreateComponentProps,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { CRM_ADMIN_ITEMS, getCRMAdminItem } from "./crmAdminRegistry";

const adminBasePath = "/crm/admin";

const getAdminItemPath = (item: SetupItem) => `${adminBasePath}/${item.key}`;

const getAdminViewPath = (
  item: SetupItem,
  view: SetupView,
  recordId?: string | number | null,
) => {
  if (view === "create") return `${getAdminItemPath(item)}/create`;
  if (view === "edit" && recordId != null) {
    return `${getAdminItemPath(item)}/edit/${recordId}`;
  }
  return getAdminItemPath(item);
};

const getAdminRouteState = (pathname: string) => {
  const relativePath = pathname.startsWith(adminBasePath)
    ? pathname.slice(adminBasePath.length)
    : "";
  const segments = relativePath.split("/").filter(Boolean);
  const selectedKey = segments[0] ?? null;
  const currentView: SetupView =
    segments[1] === "create" ? "create" : segments[1] === "edit" ? "edit" : "list";
  const recordId = currentView === "edit" ? segments[2] ?? null : null;
  return { selectedKey, currentView, recordId };
};

const CRMAdminExternalResource = ({
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
      "Este parametro se administra fuera de este espacio admin, pero se mantiene accesible desde aqui."
    }
    action={
      <Button asChild variant="secondary" size="sm">
        <Link to={to}>Abrir modulo</Link>
      </Button>
    }
  />
);

const AdminOptionsMenu = ({
  items,
  currentKey,
}: {
  items: SetupItem[];
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
        {items.map((item) => {
          const isActive = item.key === currentKey;

          return (
            <DropdownMenuItem
              key={item.key}
              className={cn(
                "py-2 text-sm",
                isActive && "bg-accent font-medium text-accent-foreground",
              )}
              onSelect={() => navigate(getAdminItemPath(item))}
            >
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const CRMAdminContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (!item.resource) return null;

  const listPath = getAdminViewPath(item, "list");
  const createPath = getAdminViewPath(item, "create");
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
        rowClick={(id: string | number) => getAdminViewPath(item, "edit", id)}
        createTo={createPath}
      />
    </ResourceContextProvider>
  );
};

export const CRMAdminPage = () => {
  const location = useLocation();
  const createPath = useCreatePath();
  const { selectedKey, currentView, recordId } = getAdminRouteState(location.pathname);
  const selectedItem = getCRMAdminItem(selectedKey);
  const defaultItem = CRM_ADMIN_ITEMS[0] ?? null;

  if (!defaultItem) {
    return (
      <div className="max-w-5xl px-2 py-3 sm:p-6">
        <SetupEmptyState
          title="Admin"
          description="No hay opciones configuradas para este espacio."
        />
      </div>
    );
  }

  if (!selectedItem) {
    return <Navigate to={getAdminItemPath(defaultItem)} replace />;
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
            eyebrowLabel="CRM / Admin"
            title={false}
            actionsPlacement="inline"
            contentClassName="px-2.5 py-2.5 sm:px-4 sm:py-3"
            actionsClassName="w-full px-2.5 pb-3 sm:px-4"
            eyebrowClassName="text-[9px] tracking-[0.16em]"
            actions={
              <>
                <div className="md:hidden">
                  <AdminOptionsMenu
                    items={CRM_ADMIN_ITEMS}
                    currentKey={selectedItem.key}
                  />
                </div>
                <SetupSectionNav
                  className="hidden md:block"
                  items={CRM_ADMIN_ITEMS}
                  currentKey={selectedItem.key}
                  getItemHref={getAdminItemPath}
                />
              </>
            }
          />
        }
        content={
          <SetupContentPanel className="px-2.5 py-4 sm:px-4 sm:py-5">
            {selectedItem.externalResource && externalResourcePath ? (
              <CRMAdminExternalResource
                label={selectedItem.label}
                description={selectedItem.description}
                to={externalResourcePath}
              />
            ) : (
              <CRMAdminContent
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

export default CRMAdminPage;

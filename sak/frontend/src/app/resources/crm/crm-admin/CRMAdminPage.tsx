"use client";

import type { ComponentType } from "react";
import { useLocation } from "react-router";
import { ResourceContextProvider } from "ra-core";

import { AppBreadcrumb } from "@/components/app-breadcrumb";
import {
  SetupContentHeader,
  SetupContentPanel,
  SetupEmptyState,
  SetupLayout,
  SetupMobileNav,
  SetupSidebar,
  SetupViewSwitcher,
  type SetupItem,
  type SetupView,
} from "@/components/forms/form_order";

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

const CRMAdminHome = () => (
  <SetupEmptyState
    title="Administracion CRM"
    description="Selecciona una opcion del menu para administrar catalogos operativos del modulo."
  />
);

const CRMAdminEmbeddedContent = ({
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

  if (view === "list") {
    const ListComponent = item.listComponent as
      | ComponentType<{
          embedded?: boolean;
          rowClick?: any;
          perPage?: number;
        }>
      | undefined;
    if (!ListComponent) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <ListComponent
          embedded
          perPage={5}
          rowClick={(id: string | number) => getAdminViewPath(item, "edit", id)}
        />
      </ResourceContextProvider>
    );
  }

  if (view === "create") {
    const CreateComponent = item.createComponent as
      | ComponentType<{ embedded?: boolean; redirect?: string }>
      | undefined;
    if (!CreateComponent) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <CreateComponent embedded redirect={listPath} />
      </ResourceContextProvider>
    );
  }

  const EditComponent = item.editComponent as
    | ComponentType<{ embedded?: boolean; id?: string | null; redirect?: string }>
    | undefined;
  if (!EditComponent || !recordId) return null;

  return (
    <ResourceContextProvider value={item.resource}>
      <EditComponent embedded id={recordId} redirect={listPath} />
    </ResourceContextProvider>
  );
};

export const CRMAdminPage = () => {
  const location = useLocation();
  const { selectedKey, currentView, recordId } = getAdminRouteState(location.pathname);
  const selectedItem = getCRMAdminItem(selectedKey);

  const breadcrumbItems = selectedItem
    ? [
        { label: "CRM" },
        { label: "Admin", to: adminBasePath },
        {
          label: selectedItem.label,
          to: getAdminItemPath(selectedItem),
          current: currentView === "list",
        },
        ...(currentView === "create"
          ? [{ label: "Crear", current: true }]
          : currentView === "edit"
            ? [{ label: `Editar${recordId ? ` #${recordId}` : ""}`, current: true }]
            : []),
      ]
    : [
        { label: "CRM" },
        { label: "Admin", current: true },
      ];

  return (
    <div className="max-w-5xl space-y-4 p-4 sm:p-6">
      <AppBreadcrumb items={breadcrumbItems} />

      <SetupLayout
        sidebar={
          <SetupSidebar
            items={CRM_ADMIN_ITEMS}
            currentKey={selectedItem?.key ?? null}
            getItemHref={getAdminItemPath}
            title="CRM Admin"
            description="Administracion operativa del modulo."
            showItemDescriptions={false}
          />
        }
        mobileNav={
          <SetupMobileNav
            title="CRM Admin"
            description="Selecciona el recurso que queres administrar."
          >
            <SetupSidebar
              items={CRM_ADMIN_ITEMS}
              currentKey={selectedItem?.key ?? null}
              getItemHref={getAdminItemPath}
              title="CRM Admin"
              description="Selecciona el item a administrar."
            />
          </SetupMobileNav>
        }
        header={
          <SetupContentHeader
            title={selectedItem?.label ?? "Administracion CRM"}
            description={
              selectedItem?.description ??
              "Accede a los recursos operativos del modulo desde un unico workspace."
            }
            actions={
              selectedItem?.resource ? (
                <SetupViewSwitcher
                  currentView={currentView}
                  listTo={getAdminViewPath(selectedItem, "list")}
                  createTo={getAdminViewPath(selectedItem, "create")}
                  canCreate={Boolean(selectedItem.createComponent)}
                />
              ) : undefined
            }
          />
        }
        content={
          <SetupContentPanel>
            {!selectedItem ? (
              <CRMAdminHome />
            ) : (
              <CRMAdminEmbeddedContent
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

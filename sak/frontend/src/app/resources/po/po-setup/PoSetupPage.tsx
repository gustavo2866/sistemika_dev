"use client";

import { Link, useLocation } from "react-router";
import type { ComponentType } from "react";
import { ResourceContextProvider, useCreatePath } from "ra-core";

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
import { Button } from "@/components/ui/button";

import { getPOSetupItem, PO_SETUP_ITEMS } from "./poSetupRegistry";

const setupBasePath = "/po/setup";

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

const POSetupHome = () => (
  <SetupEmptyState
    title="Configuracion Compras"
    description="Selecciona una opcion del menu para administrar catalogos y parametros del modulo."
  />
);

const POSetupExternalResource = ({
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
      "Este parametro se administra fuera del setup de compras, pero se mantiene accesible desde aqui."
    }
    action={
      <Button asChild variant="secondary" size="sm">
        <Link to={to}>Abrir modulo</Link>
      </Button>
    }
  />
);

const POSetupEmbeddedContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (!item.resource) return null;

  const listPath = getSetupViewPath(item, "list");

  if (view === "list") {
    const ListComponent = item.listComponent as ComponentType<{
      embedded?: boolean;
      rowClick?: any;
      perPage?: number;
    }> | undefined;
    if (!ListComponent) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <ListComponent
          embedded
          perPage={5}
          rowClick={(id: string | number) => getSetupViewPath(item, "edit", id)}
        />
      </ResourceContextProvider>
    );
  }

  if (view === "create") {
    const CreateComponent = item.createComponent;
    if (!CreateComponent) return null;

    return (
      <ResourceContextProvider value={item.resource}>
        <CreateComponent embedded redirect={listPath} />
      </ResourceContextProvider>
    );
  }

  const EditComponent = item.editComponent;
  if (!EditComponent || !recordId) return null;

  return (
    <ResourceContextProvider value={item.resource}>
      <EditComponent embedded id={recordId} redirect={listPath} />
    </ResourceContextProvider>
  );
};

export const PoSetupPage = () => {
  const location = useLocation();
  const createPath = useCreatePath();
  const { selectedKey, currentView, recordId } = getSetupRouteState(location.pathname);
  const selectedItem = getPOSetupItem(selectedKey);

  const externalResourcePath = selectedItem?.externalResource
    ? createPath({
        resource: selectedItem.externalResource,
        type: "list",
      })
    : null;

  const breadcrumbItems = selectedItem
    ? [
        { label: "Compras" },
        { label: "Configuracion", to: setupBasePath },
        {
          label: selectedItem.label,
          to: getSetupItemPath(selectedItem),
          current: currentView === "list",
        },
        ...(currentView === "create"
          ? [{ label: "Crear", current: true }]
          : currentView === "edit"
            ? [{ label: `Editar${recordId ? ` #${recordId}` : ""}`, current: true }]
            : []),
      ]
    : [
        { label: "Compras" },
        { label: "Configuracion", current: true },
      ];

  return (
    <div className="max-w-5xl space-y-4 p-4 sm:p-6">
      <AppBreadcrumb items={breadcrumbItems} />

      <SetupLayout
        sidebar={
          <SetupSidebar
            items={PO_SETUP_ITEMS}
            currentKey={selectedItem?.key ?? null}
            getItemHref={getSetupItemPath}
            title="Compras Setup"
            description="Configuracion operativa y catalogos del modulo."
            showItemDescriptions={false}
          />
        }
        mobileNav={
          <SetupMobileNav
            title="Compras Setup"
            description="Selecciona el catalogo o parametro que queres administrar."
          >
            <SetupSidebar
              items={PO_SETUP_ITEMS}
              currentKey={selectedItem?.key ?? null}
              getItemHref={getSetupItemPath}
              title="Compras Setup"
              description="Selecciona el item a administrar."
            />
          </SetupMobileNav>
        }
        header={
          <SetupContentHeader
            title={selectedItem?.label ?? "Configuracion Compras"}
            description={
              selectedItem?.description ??
              "Accede a los catalogos y parametros operativos del modulo desde un unico lugar."
            }
            actions={
              selectedItem?.resource ? (
                <SetupViewSwitcher
                  currentView={currentView}
                  listTo={getSetupViewPath(selectedItem, "list")}
                  createTo={getSetupViewPath(selectedItem, "create")}
                  canCreate={Boolean(selectedItem.createComponent)}
                />
              ) : undefined
            }
          />
        }
        content={
          <SetupContentPanel>
            {!selectedItem ? (
              <POSetupHome />
            ) : selectedItem.externalResource && externalResourcePath ? (
              <POSetupExternalResource
                label={selectedItem.label}
                description={selectedItem.description}
                to={externalResourcePath}
              />
            ) : (
              <POSetupEmbeddedContent
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

export default PoSetupPage;

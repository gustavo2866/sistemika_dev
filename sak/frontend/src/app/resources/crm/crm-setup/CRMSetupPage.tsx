"use client";

import type { ComponentType } from "react";
import { Link, useLocation } from "react-router";
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

import { CRM_SETUP_ITEMS, getCRMSetupItem } from "./crmSetupRegistry";

//#region Helpers de navegacion

const setupBasePath = "/crm/setup";

// Devuelve la ruta base de una opcion dentro del workspace de setup.
const getSetupItemPath = (item: SetupItem) => `${setupBasePath}/${item.key}`;

// Devuelve la ruta interna de la vista seleccionada para una opcion del setup.
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

// Resuelve la opcion seleccionada y la vista actual a partir de la URL.
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

//#endregion Helpers de navegacion

//#region Componentes auxiliares

// Renderiza el estado vacio inicial del workspace de setup.
const CRMSetupHome = () => (
  <SetupEmptyState
    title="Configuracion CRM"
    description="Selecciona una opcion del menu para administrar los parametros y catalogos del modulo."
  />
);

// Renderiza el estado para opciones que viven fuera del modulo CRM.
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

// Renderiza la vista embebida del catalogo seleccionado dentro del setup.
const CRMSetupEmbeddedContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (item.customComponent) {
    const CustomComponent = item.customComponent;
    return <CustomComponent embedded />;
  }

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

//#endregion Componentes auxiliares

// Renderiza el workspace principal de configuracion del modulo CRM.
export const CRMSetupPage = () => {
  const location = useLocation();
  const createPath = useCreatePath();
  const { selectedKey, currentView, recordId } = getSetupRouteState(location.pathname);
  const selectedItem = getCRMSetupItem(selectedKey);

  const externalResourcePath = selectedItem?.externalResource
    ? createPath({
        resource: selectedItem.externalResource,
        type: "list",
      })
    : null;

  const breadcrumbItems = selectedItem
    ? [
        { label: "CRM" },
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
        { label: "CRM" },
        { label: "Configuracion", current: true },
      ];

  return (
    <div className="max-w-5xl space-y-4 p-4 sm:p-6">
      <AppBreadcrumb items={breadcrumbItems} />

      <SetupLayout
        sidebar={
          <SetupSidebar
            items={CRM_SETUP_ITEMS}
            currentKey={selectedItem?.key ?? null}
            getItemHref={getSetupItemPath}
            title="CRM Setup"
            description="Configuracion operativa y catalogos del modulo."
            showItemDescriptions={false}
          />
        }
        mobileNav={
          <SetupMobileNav
            title="CRM Setup"
            description="Selecciona el catalogo o parametro que queres administrar."
          >
            <SetupSidebar
              items={CRM_SETUP_ITEMS}
              currentKey={selectedItem?.key ?? null}
              getItemHref={getSetupItemPath}
              title="CRM Setup"
              description="Selecciona el item a administrar."
            />
          </SetupMobileNav>
        }
        header={
          <SetupContentHeader
            title={selectedItem?.label ?? "Configuracion CRM"}
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
              <CRMSetupHome />
            ) : selectedItem.externalResource && externalResourcePath ? (
              <CRMSetupExternalResource
                label={selectedItem.label}
                description={selectedItem.description}
                to={externalResourcePath}
              />
            ) : (
              <CRMSetupEmbeddedContent
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

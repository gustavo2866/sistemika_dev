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

import {
  getPropiedadesConfigItem,
  PROPIEDADES_CONFIG_ITEMS,
} from "./propiedadesConfigRegistry";

const configBasePath = "/propiedades-config";

const getConfigItemPath = (item: SetupItem) => `${configBasePath}/${item.key}`;

const getConfigViewPath = (
  item: SetupItem,
  view: SetupView,
  recordId?: string | number | null,
) => {
  if (view === "create") return `${getConfigItemPath(item)}/create`;
  if (view === "edit" && recordId != null) {
    return `${getConfigItemPath(item)}/edit/${recordId}`;
  }
  return getConfigItemPath(item);
};

const getConfigRouteState = (pathname: string) => {
  const relativePath = pathname.startsWith(configBasePath)
    ? pathname.slice(configBasePath.length)
    : "";
  const segments = relativePath.split("/").filter(Boolean);
  const selectedKey = segments[0] ?? null;
  const currentView: SetupView =
    segments[1] === "create" ? "create" : segments[1] === "edit" ? "edit" : "list";
  const recordId = currentView === "edit" ? segments[2] ?? null : null;
  return { selectedKey, currentView, recordId };
};

const PropiedadesConfigHome = () => (
  <SetupEmptyState
    title="Admin"
    description="Selecciona una opcion del menu para administrar entidades vinculadas a propiedades."
  />
);

const PropiedadesConfigExternalResource = ({
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

const PropiedadesConfigEmbeddedContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (!item.resource) return null;

  const listPath = getConfigViewPath(item, "list");

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
          rowClick={(id: string | number) => getConfigViewPath(item, "edit", id)}
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

export const PropiedadesConfigPage = () => {
  const location = useLocation();
  const createPath = useCreatePath();
  const { selectedKey, currentView, recordId } = getConfigRouteState(location.pathname);
  const selectedItem = getPropiedadesConfigItem(selectedKey);

  const externalResourcePath = selectedItem?.externalResource
    ? createPath({
        resource: selectedItem.externalResource,
        type: "list",
      })
    : null;

  const breadcrumbItems = selectedItem
    ? [
        { label: "Inmobiliaria" },
        { label: "Admin", to: configBasePath },
        {
          label: selectedItem.label,
          to: getConfigItemPath(selectedItem),
          current: currentView === "list",
        },
        ...(currentView === "create"
          ? [{ label: "Crear", current: true }]
          : currentView === "edit"
            ? [{ label: `Editar${recordId ? ` #${recordId}` : ""}`, current: true }]
            : []),
      ]
    : [
        { label: "Inmobiliaria" },
        { label: "Admin", current: true },
      ];

  return (
    <div className="max-w-5xl space-y-4 p-4 sm:p-6">
      <AppBreadcrumb items={breadcrumbItems} />

      <SetupLayout
        sidebar={
          <SetupSidebar
            items={PROPIEDADES_CONFIG_ITEMS}
            currentKey={selectedItem?.key ?? null}
            getItemHref={getConfigItemPath}
            title="Admin"
            description="Recursos operativos vinculados a propiedades."
            showItemDescriptions={false}
          />
        }
        mobileNav={
          <SetupMobileNav
            title="Admin"
            description="Selecciona el recurso que queres administrar."
          >
            <SetupSidebar
              items={PROPIEDADES_CONFIG_ITEMS}
              currentKey={selectedItem?.key ?? null}
              getItemHref={getConfigItemPath}
              title="Admin"
              description="Selecciona el item a administrar."
            />
          </SetupMobileNav>
        }
        header={
          <SetupContentHeader
            title={selectedItem?.label ?? "Admin"}
            description={
              selectedItem?.description ??
              "Accede a propietarios, emprendimientos y auditoria de estados desde un unico lugar."
            }
            actions={
              selectedItem?.resource ? (
                <SetupViewSwitcher
                  currentView={currentView}
                  listTo={getConfigViewPath(selectedItem, "list")}
                  createTo={getConfigViewPath(selectedItem, "create")}
                  canCreate={Boolean(selectedItem.createComponent)}
                />
              ) : undefined
            }
          />
        }
        content={
          <SetupContentPanel>
            {!selectedItem ? (
              <PropiedadesConfigHome />
            ) : selectedItem.externalResource && externalResourcePath ? (
              <PropiedadesConfigExternalResource
                label={selectedItem.label}
                description={selectedItem.description}
                to={externalResourcePath}
              />
            ) : (
              <PropiedadesConfigEmbeddedContent
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

export default PropiedadesConfigPage;

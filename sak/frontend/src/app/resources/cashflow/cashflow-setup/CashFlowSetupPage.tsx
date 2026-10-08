"use client";

import type { ComponentType } from "react";
import { Navigate, useLocation } from "react-router";
import { ResourceContextProvider } from "ra-core";

import {
  SetupContentHeader,
  SetupContentPanel,
  SetupEmptyState,
  SetupLayout,
  SetupSectionNav,
  type SetupCreateComponentProps,
  type SetupEditComponentProps,
  type SetupItem,
  type SetupListComponentProps,
  type SetupView,
} from "@/components/forms/form_order";
import { CASHFLOW_SETUP_ITEMS, getCashFlowSetupItem } from "./cashFlowSetupRegistry";

const setupBasePath = "/cashflow/setup";
const itemPath = (item: SetupItem) => `${setupBasePath}/${item.key}`;

const viewPath = (item: SetupItem, view: SetupView, recordId?: string | number | null) => {
  if (view === "create") return `${itemPath(item)}/create`;
  if (view === "edit" && recordId != null) return `${itemPath(item)}/edit/${recordId}`;
  return itemPath(item);
};

const routeState = (pathname: string) => {
  const relative = pathname.startsWith(setupBasePath) ? pathname.slice(setupBasePath.length) : "";
  const segments = relative.split("/").filter(Boolean);
  const view: SetupView = segments[1] === "create" ? "create" : segments[1] === "edit" ? "edit" : "list";
  return { key: segments[0] ?? null, view, recordId: view === "edit" ? segments[2] ?? null : null };
};

const SetupContent = ({ item, view, recordId }: { item: SetupItem; view: SetupView; recordId?: string | null }) => {
  if (!item.resource) return null;
  const listPath = viewPath(item, "list");
  const ListComponent = item.listComponent as ComponentType<SetupListComponentProps> | undefined;
  const CreateComponent = item.createComponent as ComponentType<SetupCreateComponentProps> | undefined;
  const EditComponent = item.editComponent as ComponentType<SetupEditComponentProps> | undefined;

  return (
    <ResourceContextProvider value={item.resource}>
      {view === "create" && CreateComponent ? <CreateComponent redirect={listPath} /> : null}
      {view === "edit" && EditComponent && recordId ? <EditComponent id={recordId} redirect={listPath} /> : null}
      {view === "list" && ListComponent ? (
        <ListComponent
          rowClick={(id: string | number) => viewPath(item, "edit", id)}
          createTo={viewPath(item, "create")}
        />
      ) : null}
    </ResourceContextProvider>
  );
};

export const CashFlowSetupPage = () => {
  const location = useLocation();
  const { key, view, recordId } = routeState(location.pathname);
  const selectedItem = getCashFlowSetupItem(key);
  const defaultItem = CASHFLOW_SETUP_ITEMS[0];

  if (!defaultItem) {
    return <SetupEmptyState title="Setup" description="No hay opciones configuradas para CashFlow." />;
  }
  if (!selectedItem) return <Navigate to={itemPath(defaultItem)} replace />;

  return (
    <div className="max-w-6xl px-2 py-3 sm:p-6">
      <SetupLayout
        header={
          <SetupContentHeader
            eyebrowLabel="CashFlow / Setup"
            title={false}
            actionsPlacement="inline"
            actions={
              <SetupSectionNav
                items={CASHFLOW_SETUP_ITEMS}
                currentKey={selectedItem.key}
                getItemHref={itemPath}
                className="max-w-full"
              />
            }
          />
        }
        content={
          <SetupContentPanel className="px-2.5 py-4 sm:px-4 sm:py-5">
            <SetupContent item={selectedItem} view={view} recordId={recordId} />
          </SetupContentPanel>
        }
      />
    </div>
  );
};

export default CashFlowSetupPage;

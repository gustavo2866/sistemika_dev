"use client";

import type { ComponentType } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ResourceContextProvider } from "ra-core";

import {
  SetupContentHeader,
  SetupContentPanel,
  SetupEmptyState,
  SetupLayout,
  type SetupCreateComponentProps,
  type SetupEditComponentProps,
  type SetupItem,
  type SetupListComponentProps,
  type SetupView,
} from "@/components/forms/form_order";
import { cn } from "@/lib/utils";
import { ERP_SETUP_ITEMS, getErpSetupItem } from "./erpSetupRegistry";


const setupBasePath = "/erp/setup";
const itemPath = (item: SetupItem) => `${setupBasePath}/${item.key}`;

const viewPath = (item: SetupItem, view: SetupView, recordId?: string | number | null) => {
  if (view === "create") return `${itemPath(item)}/create`;
  if (view === "edit" && recordId != null) return `${itemPath(item)}/edit/${recordId}`;
  return itemPath(item);
};

const routeState = (pathname: string) => {
  const relative = pathname.startsWith(setupBasePath) ? pathname.slice(setupBasePath.length) : "";
  const segments = relative.split("/").filter(Boolean);
  const view: SetupView = segments[1] === "create"
    ? "create"
    : segments[1] === "edit"
      ? "edit"
      : "list";
  return {
    key: segments[0] ?? null,
    view,
    recordId: view === "edit" ? segments[2] ?? null : null,
  };
};

const ErpSetupNav = ({ currentKey }: { currentKey?: string | null }) => (
  <nav aria-label="Secciones de setup ERP" className="w-full max-w-full">
    <div className="flex w-full min-w-0 flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1.5">
      {ERP_SETUP_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={itemPath(item)}
          aria-current={item.key === currentKey ? "page" : undefined}
          className={cn(
            "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-[13px] font-medium transition-all",
            item.key === currentKey
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
              : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  </nav>
);

const SetupContent = ({
  item,
  view,
  recordId,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
}) => {
  if (!item.resource) return null;
  const listPath = viewPath(item, "list");
  const ListComponent = item.listComponent as ComponentType<SetupListComponentProps> | undefined;
  const CreateComponent = item.createComponent as ComponentType<SetupCreateComponentProps> | undefined;
  const EditComponent = item.editComponent as ComponentType<SetupEditComponentProps> | undefined;

  return (
    <ResourceContextProvider value={item.resource}>
      {view === "create" && CreateComponent ? <CreateComponent redirect={listPath} /> : null}
      {view === "edit" && EditComponent && recordId ? (
        <EditComponent id={recordId} redirect={listPath} />
      ) : null}
      {view === "list" && ListComponent ? (
        <ListComponent
          rowClick={(id: string | number) => viewPath(item, "edit", id)}
          createTo={viewPath(item, "create")}
        />
      ) : null}
    </ResourceContextProvider>
  );
};

export const ErpSetupPage = () => {
  const location = useLocation();
  const { key, view, recordId } = routeState(location.pathname);
  const selectedItem = getErpSetupItem(key);
  const defaultItem = ERP_SETUP_ITEMS[0];

  if (!defaultItem) {
    return <SetupEmptyState title="Setup ERP" description="No hay opciones configuradas." />;
  }
  if (!selectedItem) return <Navigate to={itemPath(defaultItem)} replace />;

  return (
    <div className="max-w-6xl px-2 py-3 sm:p-6">
      <SetupLayout
        header={
          <SetupContentHeader
            eyebrowLabel="ERP / Setup"
            title={false}
            actionsPlacement="inline"
            actionsClassName="w-full"
            actions={<ErpSetupNav currentKey={selectedItem.key} />}
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

export default ErpSetupPage;

"use client";

import type { ComponentType } from "react";
import { ChevronDown } from "lucide-react";
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

const CASH_ACCOUNT_MENU_ITEMS = [
  { key: "cuentas", label: "Cuentas" },
  { key: "subctas", label: "Subcuentas" },
  { key: "mapas", label: "Mapeo" },
];

const CASH_ACCOUNT_ITEM_KEYS = new Set(
  CASH_ACCOUNT_MENU_ITEMS.map((item) => item.key),
);

const CashFlowSetupNav = ({ currentKey }: { currentKey?: string | null }) => {
  const isCashAccountsActive = Boolean(
    currentKey && CASH_ACCOUNT_ITEM_KEYS.has(currentKey),
  );
  const mainItems = CASHFLOW_SETUP_ITEMS.filter(
    (item) => !CASH_ACCOUNT_ITEM_KEYS.has(item.key),
  );
  const itemClassName = (isActive: boolean) =>
    cn(
      "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-[13px] font-medium transition-all duration-150",
      isActive
        ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
    );

  return (
    <nav aria-label="Secciones de setup" className="max-w-full overflow-x-auto">
      <div className="inline-flex min-w-0 items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-current={isCashAccountsActive ? "page" : undefined}
              className={itemClassName(isCashAccountsActive)}
            >
              <span>Cuentas Cash</span>
              <ChevronDown className="ml-1.5 size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Cuentas Cash
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CASH_ACCOUNT_MENU_ITEMS.map((menuItem) => {
              const item = getCashFlowSetupItem(menuItem.key);
              if (!item) return null;
              const isActive = item.key === currentKey;

              return (
                <DropdownMenuItem
                  key={item.key}
                  className={cn(
                    "py-2 text-sm",
                    isActive && "bg-accent font-medium text-accent-foreground",
                  )}
                  asChild
                >
                  <Link to={itemPath(item)}>{menuItem.label}</Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {mainItems.map((item) => {
          const isActive = item.key === currentKey;

          return (
            <Link
              key={item.key}
              to={itemPath(item)}
              aria-current={isActive ? "page" : undefined}
              className={itemClassName(isActive)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const SetupContent = ({
  item,
  view,
  recordId,
  returnTo,
}: {
  item: SetupItem;
  view: SetupView;
  recordId?: string | null;
  returnTo?: string;
}) => {
  if (!item.resource) return null;
  const listPath = viewPath(item, "list");
  const ListComponent = item.listComponent as ComponentType<SetupListComponentProps> | undefined;
  const CreateComponent = item.createComponent as ComponentType<SetupCreateComponentProps> | undefined;
  const EditComponent = item.editComponent as ComponentType<SetupEditComponentProps> | undefined;

  return (
    <ResourceContextProvider value={item.resource}>
      {view === "create" && CreateComponent ? (
        <CreateComponent redirect={returnTo ?? listPath} />
      ) : null}
      {view === "edit" && EditComponent && recordId ? (
        <EditComponent id={recordId} redirect={returnTo ?? listPath} />
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

export const CashFlowSetupPage = () => {
  const location = useLocation();
  const { key, view, recordId } = routeState(location.pathname);
  const routeReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof routeReturnTo === "string" ? routeReturnTo : undefined;
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
            actions={<CashFlowSetupNav currentKey={selectedItem.key} />}
          />
        }
        content={
          <SetupContentPanel className="px-2.5 py-4 sm:px-4 sm:py-5">
            <SetupContent
              item={selectedItem}
              view={view}
              recordId={recordId}
              returnTo={returnTo}
            />
          </SetupContentPanel>
        }
      />
    </div>
  );
};

export default CashFlowSetupPage;

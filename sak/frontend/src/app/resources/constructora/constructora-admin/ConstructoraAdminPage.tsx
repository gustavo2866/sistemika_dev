"use client";

import { Fragment, type ComponentType } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  CONSTRUCTORA_ADMIN_ITEMS,
  getConstructoraAdminItem,
} from "./constructoraAdminRegistry";

const adminBasePath = "/constructora-admin";
const encargadoItemKeys = new Set(["encargados", "proyecto-encargados"]);

const getEncargadoItems = () =>
  CONSTRUCTORA_ADMIN_ITEMS.filter((item) => encargadoItemKeys.has(item.key));

const getTopLevelItems = () =>
  CONSTRUCTORA_ADMIN_ITEMS.filter((item) => !encargadoItemKeys.has(item.key));

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

const AdminOptionsMenu = ({
  currentKey,
}: {
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
        {getTopLevelItems().map((item, index) => {
          const isActive = item.key === currentKey;

          return (
            <Fragment key={item.key}>
              {index === 1 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    className={cn(
                      "py-2 text-sm",
                      encargadoItemKeys.has(currentKey ?? "") &&
                        "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    Encargados
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {getEncargadoItems().map((encargadoItem) => (
                      <DropdownMenuItem
                        key={encargadoItem.key}
                        className={cn(
                          "py-2 text-sm",
                          encargadoItem.key === currentKey &&
                            "bg-accent font-medium text-accent-foreground",
                        )}
                        onSelect={() => navigate(getAdminItemPath(encargadoItem))}
                      >
                        {encargadoItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              <DropdownMenuItem
                className={cn(
                  "py-2 text-sm",
                  isActive && "bg-accent font-medium text-accent-foreground",
                )}
                onSelect={() => navigate(getAdminItemPath(item))}
              >
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AdminSectionNav = ({ currentKey }: { currentKey?: string | null }) => {
  const encargadoActive = encargadoItemKeys.has(currentKey ?? "");
  const topLevelItems = getTopLevelItems();
  const navItemClass = (active: boolean) =>
    cn(
      "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-[13px] font-medium transition-all duration-150",
      active
        ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
    );

  return (
    <nav aria-label="Secciones de admin" className="hidden overflow-x-auto md:block">
      <div className="inline-flex min-w-0 items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        {topLevelItems.map((item, index) => (
          <div key={item.key} className="contents">
            {index === 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={navItemClass(encargadoActive)}>
                    {encargadoActive ? (
                      <span className="absolute inset-y-1.5 left-1.5 w-[3px] rounded-full bg-foreground/80" />
                    ) : null}
                    <span className={cn("truncate", encargadoActive && "pl-2.5")}>
                      Encargados
                    </span>
                    <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {getEncargadoItems().map((encargadoItem) => (
                    <DropdownMenuItem key={encargadoItem.key} asChild>
                      <Link to={getAdminItemPath(encargadoItem)}>
                        {encargadoItem.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Link
              to={getAdminItemPath(item)}
              aria-current={item.key === currentKey ? "page" : undefined}
              className={navItemClass(item.key === currentKey)}
            >
              {item.key === currentKey ? (
                <span className="absolute inset-y-1.5 left-1.5 w-[3px] rounded-full bg-foreground/80" />
              ) : null}
              <span className={cn("truncate", item.key === currentKey && "pl-2.5")}>
                {item.label}
              </span>
            </Link>
          </div>
        ))}
      </div>
    </nav>
  );
};

const ConstructoraAdminContent = ({
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

export const ConstructoraAdminPage = () => {
  const location = useLocation();
  const { selectedKey, currentView, recordId } = getAdminRouteState(location.pathname);
  const selectedItem = getConstructoraAdminItem(selectedKey);
  const defaultItem = CONSTRUCTORA_ADMIN_ITEMS[0] ?? null;

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

  return (
    <div className="max-w-5xl px-2 py-3 sm:p-6">
      <SetupLayout
        header={
          <SetupContentHeader
            eyebrowLabel="Constructora / Admin"
            title={false}
            actionsPlacement="inline"
            contentClassName="px-2.5 py-2.5 sm:px-4 sm:py-3"
            actionsClassName="w-full px-2.5 pb-3 sm:px-4"
            eyebrowClassName="text-[9px] tracking-[0.16em]"
            actions={
              <>
                <div className="md:hidden">
                  <AdminOptionsMenu currentKey={selectedItem.key} />
                </div>
                <AdminSectionNav currentKey={selectedItem.key} />
              </>
            }
          />
        }
        content={
          <SetupContentPanel className="px-2.5 py-4 sm:px-4 sm:py-5">
            <ConstructoraAdminContent
              item={selectedItem}
              view={currentView}
              recordId={recordId}
            />
          </SetupContentPanel>
        }
      />
    </div>
  );
};

export default ConstructoraAdminPage;

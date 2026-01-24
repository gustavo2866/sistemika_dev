import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  ListBase,
  ListBaseProps,
  type ListControllerResult,
  RaRecord,
  Translate,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
  useResourceDefinition,
  useTranslate,
} from "ra-core";
import { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { FilterContext, FilterElementProps } from "@/hooks/filter-context";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ListPagination } from "@/components/list-pagination";
import { FilterForm } from "@/components/filter-form";

export const List = <RecordType extends RaRecord = RaRecord>(
  props: ListProps<RecordType>,
) => {
  const {
    debounce,
    disableAuthentication,
    disableSyncWithLocation,
    exporter,
    filter,
    filterDefaultValues,
    loading,
    perPage,
    queryOptions,
    resource,
    sort,
    storeKey,
    ...rest
  } = props;

  return (
    <ListBase<RecordType>
      debounce={debounce}
      disableAuthentication={disableAuthentication}
      disableSyncWithLocation={disableSyncWithLocation}
      exporter={exporter}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      loading={loading}
      perPage={perPage}
      queryOptions={queryOptions}
      resource={resource}
      sort={sort}
      storeKey={storeKey}
    >
      <ListView<RecordType> {...rest} />
    </ListBase>
  );
};

export interface ListProps<RecordType extends RaRecord = RaRecord>
  extends ListBaseProps<RecordType>,
    ListViewProps<RecordType> {}

export const ListView = <RecordType extends RaRecord = RaRecord>(
  props: ListViewProps<RecordType>,
) => {
  const {
    filters,
    pagination = defaultPagination,
    title,
    children,
    actions,
    showBreadcrumb = true,
  } = props;
  const translate = useTranslate();
  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The ListView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const resourceLabel = getResourceLabel(resource, 2);
  const finalTitle =
    title !== undefined
      ? title
      : translate("ra.page.list", {
          name: resourceLabel,
        });
  const { hasCreate } = useResourceDefinition({ resource });
  const hasDashboard = useHasDashboard();

  return (
    <div className="w-full lg:max-w-[1080px] lg:mr-auto">
      {showBreadcrumb ? (
        <Breadcrumb>
          {hasDashboard && (
            <BreadcrumbItem>
              <Link to="/">
                <Translate i18nKey="ra.page.dashboard">Home</Translate>
              </Link>
            </BreadcrumbItem>
          )}
          <BreadcrumbPage>{resourceLabel}</BreadcrumbPage>
        </Breadcrumb>
      ) : null}

      <FilterContext.Provider value={filters}>
        <div className="flex flex-wrap items-center justify-between gap-3 my-2 sm:my-3">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {finalTitle}
          </h2>
          {actions ?? (
            <div className="flex items-center gap-2">
              {hasCreate ? (
                <CreateButton
                  size="sm"
                  className="h-7 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                />
              ) : null}
              {
                <ExportButton
                  size="sm"
                  className="h-7 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                />
              }
            </div>
          )}
        </div>
        <div className="bg-muted/30 rounded-lg p-2 sm:p-4 mb-3 sm:mb-4">
          <FilterForm className="pointer-events-auto flex w-full flex-wrap items-center gap-3" />
        </div>
        <div className={cn(props.className)}>{children}</div>
        {pagination}
      </FilterContext.Provider>
    </div>
  );
};

const defaultPagination = <ListPagination />;

export interface ListViewProps<RecordType extends RaRecord = RaRecord> {
  children?: ReactNode;
  render?: (props: ListControllerResult<RecordType, Error>) => ReactNode;
  actions?: ReactElement | false;
  filters?: ReactElement<FilterElementProps>[];
  pagination?: ReactNode;
  title?: ReactNode | string | false;
  className?: string;
  showBreadcrumb?: boolean;
}

export type FiltersType =
  | ReactElement<FilterElementProps>
  | ReactElement<FilterElementProps>[];

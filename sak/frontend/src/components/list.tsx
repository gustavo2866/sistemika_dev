import { AppBreadcrumb } from "@/components/app-breadcrumb";
import {
  ListBase,
  ListBaseProps,
  type ListControllerResult,
  RaRecord,
  useGetResourceLabel,
  useResourceContext,
  useResourceDefinition,
  useTranslate,
} from "ra-core";
import { ReactElement, ReactNode } from "react";
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
    topContent,
    showBreadcrumb = true,
    showHeader = true,
    containerClassName,
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

  return (
    <div className={cn("w-full max-w-3xl", containerClassName)}>
      {showBreadcrumb ? (
        <AppBreadcrumb
          items={[{ label: resourceLabel, current: true }]}
        />
      ) : null}

      <FilterContext.Provider value={filters}>
        {showHeader ? (
          <div className="flex flex-wrap items-center justify-between gap-3 my-2 sm:my-3 w-full max-w-3xl">
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
        ) : null}
        {topContent ? (
          <div className="mb-2 w-full max-w-3xl">
            {topContent}
          </div>
        ) : null}
        <div className="bg-muted/30 rounded-lg p-1 sm:p-2 mb-1 sm:mb-2 w-full max-w-3xl">
          <FilterForm className="list-filters pointer-events-auto flex w-full flex-wrap items-center gap-3" />
        </div>
        <div className={cn(props.className, "w-full max-w-3xl")}>{children}</div>
        <div className="w-full max-w-3xl">{pagination}</div>
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
  topContent?: ReactNode;
  pagination?: ReactNode;
  title?: ReactNode | string | false;
  className?: string;
  showBreadcrumb?: boolean;
  showHeader?: boolean;
  containerClassName?: string;
}

export type FiltersType =
  | ReactElement<FilterElementProps>
  | ReactElement<FilterElementProps>[];

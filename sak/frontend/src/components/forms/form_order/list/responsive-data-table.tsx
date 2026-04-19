import {
  Children,
  createElement,
  isValidElement,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  DataTableBase,
  DataTableRenderContext,
  RaRecord,
  RecordContextProvider,
  useDataTableCallbacksContext,
  useDataTableConfigContext,
  useDataTableDataContext,
  useDataTableSelectedIdsContext,
  useDataTableStoreContext,
  useGetPathForRecordCallback,
  useRecordContext,
  useResourceContext,
  useStore,
} from "ra-core";
import { useNavigate } from "react-router";
import get from "lodash/get";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ColumnsSelector,
  ColumnsSelectorItem,
} from "@/components/columns-button";
import {
  BulkActionsToolbar,
  BulkActionsToolbarChildren,
} from "@/components/bulk-actions-toolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { DataTable, type DataTableColumnProps, type DataTableProps } from "@/components/data-table";

type MobileConfig =
  | {
      customCard: (record: any) => ReactNode;
      primaryField?: never;
      secondaryFields?: never;
      badge?: never;
      detailFields?: never;
      descriptionField?: never;
    }
  | {
      customCard?: never;
      primaryField: string;
      secondaryFields?: string[];
      badge?: {
        source: string;
        choices?: ReadonlyArray<{ readonly id: any; readonly name: string }>;
      };
      detailFields?: Array<{
        source: string;
        type?: string;
        reference?: string;
        referenceField?: string;
        format?: (value: any) => string;
      }>;
      descriptionField?: {
        source: string;
        truncate?: number;
      };
    };

const defaultBulkActionButtons = <BulkActionsToolbarChildren />;

const DataTableMobileCell = <RecordType extends RaRecord = RaRecord>(
  props: DataTableColumnProps<RecordType>
) => {
  const {
    children,
    render,
    field,
    source,
    className,
    cellClassName,
    conditionalClassName,
    label,
  } = props;

  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns] = useStore<string[]>(storeKey, defaultHiddenColumns);
  const record = useRecordContext<RecordType>();
  const isColumnHidden = hiddenColumns.includes(source!);
  if (isColumnHidden) return null;
  if (!render && !field && !children && !source) {
    return null;
  }

  const content =
    children ??
    (render
      ? record && render(record)
      : field
      ? createElement(field, { source })
      : get(record, source!));

  return (
    <div
      className={cn(
        "text-sm",
        className,
        cellClassName,
        record && conditionalClassName?.(record)
      )}
    >
      {label && (
        <span className="font-medium text-muted-foreground mr-2">
          {label}:
        </span>
      )}
      {content}
    </div>
  );
};

const DataTableMobileView = <RecordType extends RaRecord = RaRecord>({
  children,
  rowClassName,
  mobileConfig,
  compact = false,
}: {
  children: ReactNode;
  mobileConfig?: MobileConfig;
  rowClassName?: (record: RecordType) => string | undefined;
  compact?: boolean;
}) => {
  const data = useDataTableDataContext();
  const { rowClick, handleToggleItem } = useDataTableCallbacksContext();
  const selectedIds = useDataTableSelectedIdsContext();
  const { hasBulkActions = false } = useDataTableConfigContext();
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns] = useStore<string[]>(storeKey, defaultHiddenColumns);
  const resource = useResourceContext();
  const navigate = useNavigate();
  const getPathForRecord = useGetPathForRecordCallback();

  const columns = useMemo(
    () =>
      Children.toArray(children)
        .filter((child): child is React.ReactElement<DataTableColumnProps<RecordType>> =>
          isValidElement(child)
        )
        .map((child, index) => ({
          key: child.key ?? index,
          props: child.props as DataTableColumnProps<RecordType>,
        })),
    [children]
  );

  const columnMap = useMemo(() => {
    const map = new Map<string, DataTableColumnProps<RecordType>>();
    columns.forEach(({ props }) => {
      if (props.source) {
        map.set(String(props.source), props);
      }
    });
    return map;
  }, [columns]);

  const humanize = useCallback((value: string) => {
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const truncate = useCallback((value: string, max: number) => {
    if (value.length <= max) return value;
    return `${value.substring(0, max)}...`;
  }, []);

  const getChoiceLabel = useCallback(
    (value: any, choices?: readonly { id: any; name: string }[]) => {
      if (!choices) return value;
      const found = choices.find((choice) => choice.id === value);
      return found?.name ?? value;
    },
    []
  );

  const isColumnHidden = useCallback(
    (source?: string) => (source ? hiddenColumns.includes(String(source)) : false),
    [hiddenColumns]
  );

  if (!data || data.length === 0) {
    return <DataTableEmpty />;
  }

  const checkboxClassName = compact
    ? "mt-0.5 size-2.5 rounded-[3px] [&_[data-slot=checkbox-indicator]_*]:size-2"
    : "mt-0 h-3.5 w-3.5";

  return (
    <div className="space-y-3 pl-0.5 pr-4 py-3 sm:px-4 sm:py-4">
      {data.map((record, rowIndex) => {
        const handleToggle = (checked: boolean | string) => {
          if (!handleToggleItem) return;
          const nextChecked =
            checked === "indeterminate"
              ? !isSelected
              : Boolean(checked);

          const syntheticEvent = {
            stopPropagation: () => {},
            target: { checked: nextChecked },
          } as unknown as React.MouseEvent & {
            target: { checked: boolean };
          };

          handleToggleItem(record.id, syntheticEvent);
        };

        const handleClick = async () => {
          if (!resource) return;

          const temporaryLink =
            typeof rowClick === "function"
              ? rowClick(record.id, resource, record)
              : rowClick;

          const link = isPromise(temporaryLink) ? await temporaryLink : temporaryLink;

          const path = await getPathForRecord({
            record,
            resource,
            link,
          });
          if (path === false || path == null) {
            return;
          }
          navigate(path, {
            state: { _scrollToTop: true },
          });
        };

        const isSelected = record?.id != null && selectedIds?.includes(record.id);

        const renderColumnCell = (
          key: React.Key,
          columnProps: DataTableColumnProps<RecordType>,
          options?: { hideLabel?: boolean; className?: string }
        ) => (
          <RecordContextProvider value={record} key={key}>
            <DataTableMobileCell
              {...columnProps}
              label={options?.hideLabel ? undefined : columnProps.label}
              className={cn(options?.className, columnProps.className)}
            />
          </RecordContextProvider>
        );

        const renderInlineColumnCell = (
          key: React.Key,
          columnProps: DataTableColumnProps<RecordType>,
          options?: { className?: string }
        ) => {
          const { children, render, field, source } = columnProps;
          const content =
            children ??
            (render
              ? record && render(record)
              : field
              ? createElement(field, { source })
              : get(record, source!));

          if (content == null || content === "") {
            return null;
          }

          return (
            <RecordContextProvider value={record} key={key}>
              <span
                className={cn(
                  "inline-flex items-start leading-tight",
                  options?.className
                )}
              >
                {content}
              </span>
            </RecordContextProvider>
          );
        };

  const getRecordValue = (source?: string) => {
    if (!source) return undefined;
    return get(record, source);
  };

  const toBooleanValue = (value: unknown): boolean | undefined => {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
    return undefined;
  };

        const isActionColumn = (columnProps: DataTableColumnProps<RecordType>) => {
          const label =
            typeof columnProps.label === "string"
              ? columnProps.label.toLowerCase()
              : "";
          if (label.includes("accion")) return true;
          if (columnProps.source) return false;
          return Boolean(columnProps.children || columnProps.render || columnProps.field);
        };

        const renderConfiguredContent = () => {
          if (!mobileConfig) {
            const visibleColumns = columns.filter(
              ({ props }) => !isColumnHidden(props.source)
            );
            const actionColumnIndex = [...visibleColumns]
              .reverse()
              .findIndex(({ props }) => isActionColumn(props));
            const actionColumn =
              actionColumnIndex >= 0
                ? visibleColumns[visibleColumns.length - 1 - actionColumnIndex]
                : null;
            const nonActionColumns = actionColumn
              ? visibleColumns.filter((column) => column !== actionColumn)
              : visibleColumns;
            const firstColumn = nonActionColumns[0];
            const secondColumn = nonActionColumns[1];
            const bodyColumns = nonActionColumns.slice(2);
            const isIdPrimary =
              firstColumn?.props.source &&
              String(firstColumn.props.source) === "id" &&
              secondColumn;

            return (
              <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-x-2 overflow-hidden">
                  {isIdPrimary ? (
                    <div className="min-w-0 text-[12px] font-semibold leading-[1.1] break-words hyphens-auto">
                      <span className="inline">
                        {renderInlineColumnCell(
                          firstColumn.key ?? firstColumn.props.source ?? 0,
                          firstColumn.props,
                          { className: "inline" }
                        )}
                        <span className="mx-0.5">-</span>
                        {renderInlineColumnCell(
                          secondColumn.key ?? secondColumn.props.source ?? 1,
                          secondColumn.props,
                          { className: "inline" }
                        )}
                      </span>
                    </div>
                  ) : (
                    <>
                      {firstColumn
                        ? renderColumnCell(
                            firstColumn.key ?? firstColumn.props.source ?? 0,
                            firstColumn.props,
                            {
                              hideLabel: true,
                              className: "text-[12px] font-semibold leading-[1.1] break-words hyphens-auto",
                            }
                          )
                        : null}
                      {secondColumn
                        ? renderColumnCell(
                            secondColumn.key ?? secondColumn.props.source ?? 1,
                            secondColumn.props,
                            {
                              hideLabel: true,
                              className:
                                "text-[11px] text-muted-foreground truncate",
                            }
                          )
                        : null}
                    </>
                  )}
                </div>
                  {actionColumn
                    ? renderColumnCell(
                        actionColumn.key ?? actionColumn.props.source ?? "actions",
                        actionColumn.props,
                        {
                          hideLabel: true,
                          className: "flex items-center justify-end",
                        }
                      )
                    : null}
                </div>
                {bodyColumns.length > 0 ? (
                  <div className="w-full text-[10px] text-muted-foreground sm:text-[11px]">
                    <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1 [&_[data-slot=badge]]:px-1 [&_[data-slot=badge]]:py-0 [&_[data-slot=badge]]:text-[9px] sm:[&_[data-slot=badge]]:text-xs">
                      {bodyColumns.map(({ props, key: columnKey }, index) => {
                        const node = renderInlineColumnCell(
                          columnKey ?? props.source ?? index,
                          props,
                          { className: "text-[9px] text-muted-foreground sm:text-[10px]" }
                        );
                        if (!node) return null;
                        return node;
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          }

          if (mobileConfig.customCard) {
            return mobileConfig.customCard(record);
          }

          const visibleColumns = columns.filter(
            ({ props }) => !isColumnHidden(props.source)
          );
          const actionColumnIndex = [...visibleColumns]
            .reverse()
            .findIndex(({ props }) => isActionColumn(props));
          const actionColumn =
            actionColumnIndex >= 0
              ? visibleColumns[visibleColumns.length - 1 - actionColumnIndex]
              : null;
          const actionNode = actionColumn
            ? renderColumnCell(
                actionColumn.key ?? actionColumn.props.source ?? "actions",
                actionColumn.props,
                {
                  hideLabel: true,
                  className: "flex items-center justify-end",
                }
              )
            : null;

          const primaryNode = mobileConfig.primaryField
            ? (() => {
                const column = columnMap.get(mobileConfig.primaryField!);
                if (column) {
                  return renderColumnCell(
                    `${mobileConfig.primaryField}-primary`,
                    column,
                    { hideLabel: true, className: "text-base font-semibold" }
                  );
                }
                const raw = getRecordValue(mobileConfig.primaryField);
                if (raw == null || raw === "") return null;
                return (
                  <div className="text-base font-semibold">
                    {String(raw)}
                  </div>
                );
              })()
            : null;

          const badgeNode = mobileConfig.badge
            ? (() => {
                const raw = getRecordValue(mobileConfig.badge?.source);
                if (raw == null || raw === "") return null;
                const label = getChoiceLabel(raw, mobileConfig.badge?.choices);
                return <Badge variant="secondary">{String(label)}</Badge>;
              })()
            : null;

          const secondaryNodes =
            mobileConfig.secondaryFields
              ?.map((field) => {
                const raw = getRecordValue(field);
                const booleanValue = toBooleanValue(raw);
                const column = columnMap.get(field);
                if (booleanValue !== undefined) {
                  return (
                    <div
                      key={`${field}-secondary`}
                      className="flex items-center gap-1 text-[8px] text-muted-foreground leading-tight [&_*]:text-[8px]"
                    >
                      <span className="font-medium">
                        {column?.label ?? humanize(field)}:
                      </span>
                      <span className="inline-flex items-center text-[8px]">
                        {booleanValue ? "Si" : "No"}
                      </span>
                    </div>
                  );
                }
                if (column) {
                  const content = renderInlineColumnCell(
                    `${field}-secondary`,
                    column,
                    { className: "inline-flex items-center text-[8px]" }
                  );
                  if (!content) {
                    return null;
                  }
                  return (
                    <div
                      key={`${field}-secondary`}
                      className="flex items-center gap-1 text-[8px] text-muted-foreground leading-tight [&_*]:text-[8px]"
                    >
                      <span className="font-medium">{column.label ?? humanize(field)}:</span>
                      {content}
                    </div>
                  );
                }
                if (raw == null || raw === "") return null;
                const label = humanize(field);
                return (
                  <div
                    key={`${field}-secondary`}
                    className="flex items-center gap-1 text-[8px] text-muted-foreground leading-tight [&_*]:text-[8px]"
                  >
                    <span className="font-medium">{label}:</span>
                    {String(raw)}
                  </div>
                );
              })
              .filter(Boolean) ?? [];

          const descriptionNode = mobileConfig.descriptionField
            ? (() => {
                const raw = getRecordValue(mobileConfig.descriptionField?.source);
                if (!raw) return null;
                const text = String(raw);
                const truncated =
                  mobileConfig.descriptionField?.truncate != null
                    ? truncate(text, mobileConfig.descriptionField.truncate)
                    : text;
                return (
                  <div className="text-sm text-muted-foreground">
                    {truncated}
                  </div>
                );
              })()
            : null;

          const detailNodes =
            mobileConfig.detailFields
              ?.map((detailField, index) => {
                const fieldSource =
                  typeof detailField === "string"
                    ? detailField
                    : detailField.source;
                if (!fieldSource) return null;
                const column = columnMap.get(fieldSource);
                if (column) {
                  return renderColumnCell(
                    `${fieldSource}-detail`,
                    column,
                    { className: "text-xs text-muted-foreground" }
                  );
                }
                const raw = getRecordValue(fieldSource);
                if (raw == null || raw === "") return null;
                const label = humanize(fieldSource);
                return (
                  <div
                    key={`${fieldSource}-detail-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    <span className="font-medium">{label}: </span>
                    {String(raw)}
                  </div>
                );
              })
              .filter(Boolean) ?? [];

          return (
            <div className="space-y-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">{primaryNode}</div>
                {actionNode}
              </div>
              {badgeNode ? <div>{badgeNode}</div> : null}
              {secondaryNodes.length > 0 && (
                <div className="space-y-0.5">{secondaryNodes}</div>
              )}
              {descriptionNode}
              {detailNodes.length > 0 && (
                <div className="space-y-0.5">{detailNodes}</div>
              )}
            </div>
          );
        };

        return (
          <RecordContextProvider
            value={record}
            key={record.id ?? `row${rowIndex}`}
          >
            <Card
              className={cn(
                "py-2 transition-shadow",
                isSelected && "border-primary/70 shadow-sm shadow-primary/20",
                rowClick !== false && "cursor-pointer hover:shadow-md",
                rowClassName?.(record)
              )}
              onClick={(event) => {
                if (event.defaultPrevented) {
                  return;
                }
                const target = event.target as Element | null;
                if (target?.closest?.('[data-row-click="ignore"]')) {
                  return;
                }
                handleClick();
              }}
            >
              <div className="flex items-center gap-3 px-3 py-1">
                {hasBulkActions && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleToggle}
                    onClick={(e) => e.stopPropagation()}
                    className={checkboxClassName}
                    aria-label="Seleccionar registro"
                  />
                )}

                <div className="flex-1 min-w-0">
                  {renderConfiguredContent()}
                </div>
              </div>
            </Card>
          </RecordContextProvider>
        );
      })}
    </div>
  );
};

export interface ResponsiveDataTableProps<RecordType extends RaRecord = RaRecord>
  extends DataTableProps<RecordType> {
  mobileConfig?: MobileConfig;
  emptyMessage?: ReactNode;
}

export function ResponsiveDataTable<RecordType extends RaRecord = RaRecord>(
  props: ResponsiveDataTableProps<RecordType>
) {
  const {
    children,
    rowClassName,
    compact = false,
    bulkActionButtons = defaultBulkActionButtons,
    bulkActionsToolbar,
    mobileConfig,
    emptyMessage,
    ...rest
  } = props;
  const isMobile = useIsMobile();
  const hasBulkActions = !!bulkActionsToolbar || bulkActionButtons !== false;
  const resourceFromContext = useResourceContext(props);
  const storeKey = props.storeKey || `${resourceFromContext}.datatable`;
  const [columnRanks] = useStore<number[]>(`${storeKey}_columnRanks`);
  const columns = columnRanks ? reorderChildren(children, columnRanks) : children;

  if (!isMobile) {
    return (
      <DataTable<RecordType>
        {...rest}
        rowClassName={rowClassName}
        compact={compact}
        bulkActionButtons={bulkActionButtons}
        bulkActionsToolbar={bulkActionsToolbar}
      >
        {columns}
      </DataTable>
    );
  }

  return (
    <DataTableBase<RecordType>
      hasBulkActions={hasBulkActions}
      loading={null}
      empty={<DataTableEmpty message={emptyMessage} />}
      {...rest}
    >
      <DataTableMobileView<RecordType>
        mobileConfig={mobileConfig}
        rowClassName={rowClassName}
        compact={compact}
      >
        {columns}
      </DataTableMobileView>
      {bulkActionsToolbar ??
        (bulkActionButtons !== false && (
          <BulkActionsToolbar>
            {isValidElement(bulkActionButtons)
              ? bulkActionButtons
              : defaultBulkActionButtons}
          </BulkActionsToolbar>
        ))}
      <DataTableRenderContext.Provider value="columnsSelector">
        <ColumnsSelector>{children}</ColumnsSelector>
      </DataTableRenderContext.Provider>
    </DataTableBase>
  );
}

ResponsiveDataTable.Col = DataTable.Col;
ResponsiveDataTable.NumberCol = DataTable.NumberCol;

const DataTableEmpty = ({ message = "No results found." }: { message?: ReactNode }) => {
  return (
    <Alert>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};

/**
 * Reorder children based on columnRanks
 */
const reorderChildren = (children: ReactNode, columnRanks: number[]) =>
  Children.toArray(children).reduce((acc: ReactNode[], child, index) => {
    const rank = columnRanks.indexOf(index);
    if (rank === -1) {
      acc[index] = child;
    } else {
      acc[rank] = child;
    }
    return acc;
  }, []);

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function";

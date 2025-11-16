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
  DataTableBaseProps,
  DataTableRenderContext,
  ExtractRecordPaths,
  FieldTitle,
  HintedString,
  Identifier,
  RaRecord,
  RecordContextProvider,
  SortPayload,
  useDataTableCallbacksContext,
  useDataTableConfigContext,
  useDataTableDataContext,
  useDataTableRenderContext,
  useDataTableSelectedIdsContext,
  useDataTableSortContext,
  useDataTableStoreContext,
  useGetPathForRecordCallback,
  useRecordContext,
  useResourceContext,
  useStore,
  useTranslate,
  useTranslateLabel,
} from "ra-core";
import { useNavigate } from "react-router";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import get from "lodash/get";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ColumnsSelector,
  ColumnsSelectorItem,
} from "@/components/columns-button";
import { NumberField } from "@/components/number-field";
import {
  BulkActionsToolbar,
  BulkActionsToolbarChildren,
} from "@/components/bulk-actions-toolbar";
import { useIsMobile } from "@/hooks/use-mobile";

type MobileConfig = {
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
  customCard?: (record: any) => ReactNode;
};

const defaultBulkActionButtons = <BulkActionsToolbarChildren />;

const DataTableMobileView = <RecordType extends RaRecord = RaRecord>({
  children,
  rowClassName,
  mobileConfig,
}: {
  children: ReactNode;
  mobileConfig?: MobileConfig;
  rowClassName?: (record: RecordType) => string | undefined;
}) => {
  const data = useDataTableDataContext();
  const { rowClick, handleToggleItem } = useDataTableCallbacksContext();
  const selectedIds = useDataTableSelectedIdsContext();
  const { hasBulkActions = false } = useDataTableConfigContext();
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
    return `${value.substring(0, max)}…`;
  }, []);

  const getChoiceLabel = useCallback(
    (value: any, choices?: readonly { id: any; name: string }[]) => {
      if (!choices) return value;
      const found = choices.find((choice) => choice.id === value);
      return found?.name ?? value;
    },
    []
  );

  if (!data || data.length === 0) {
    return <DataTableEmpty />;
  }

  return (
    <div className="space-y-3 p-4">
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

        const getRecordValue = (source?: string) => {
          if (!source) return undefined;
          return get(record, source);
        };

        const renderConfiguredContent = () => {
          if (!mobileConfig) {
            return (
              <div className="space-y-1">
                {columns.map(({ props, key: columnKey }, index) =>
                  renderColumnCell(columnKey ?? props.source ?? index, props)
                )}
              </div>
            );
          }

          if (mobileConfig.customCard) {
            return mobileConfig.customCard(record);
          }

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
                return (
                  <Badge variant="secondary">
                    {String(label)}
                  </Badge>
                );
              })()
            : null;

          const secondaryNodes =
            mobileConfig.secondaryFields
              ?.map((field) => {
                const column = columnMap.get(field);
                if (column) {
                  return renderColumnCell(
                    `${field}-secondary`,
                    column,
                    { hideLabel: true, className: "text-sm text-muted-foreground" }
                  );
                }
                const raw = getRecordValue(field);
                if (raw == null || raw === "") return null;
                return (
                  <div
                    key={`${field}-secondary`}
                    className="text-sm text-muted-foreground"
                  >
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
            <div className="space-y-2">
              {primaryNode}
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
                "transition-shadow",
                isSelected && "border-primary/70 shadow-sm shadow-primary/20",
                rowClick !== false && "cursor-pointer hover:shadow-md",
                rowClassName?.(record)
              )}
              onClick={handleClick}
            >
              <div className="flex items-start gap-3 p-4">
                {hasBulkActions && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleToggle}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
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

export function DataTable<RecordType extends RaRecord = RaRecord>(
  props: DataTableProps<RecordType>
) {
  const {
    children,
    className,
    rowClassName,
    bulkActionButtons = defaultBulkActionButtons,
    bulkActionsToolbar,
    mobileConfig,
    ...rest
  } = props;
  const isMobile = useIsMobile();
  const hasBulkActions = !!bulkActionsToolbar || bulkActionButtons !== false;
  const resourceFromContext = useResourceContext(props);
  const storeKey = props.storeKey || `${resourceFromContext}.datatable`;
  const [columnRanks] = useStore<number[]>(`${storeKey}_columnRanks`);
  const columns = columnRanks
    ? reorderChildren(children, columnRanks)
    : children;

  return (
    <DataTableBase<RecordType>
      hasBulkActions={hasBulkActions}
      loading={null}
      empty={<DataTableEmpty />}
      {...rest}
    >
      {isMobile ? (
        <DataTableMobileView<RecordType> 
          mobileConfig={mobileConfig}
          rowClassName={rowClassName}
        >
          {columns}
        </DataTableMobileView>
      ) : (
        <div className={cn("rounded-md border", className)}>
          <Table className="table-fixed">
            <DataTableRenderContext.Provider value="header">
              <DataTableHead>{columns}</DataTableHead>
            </DataTableRenderContext.Provider>
            <DataTableBody<RecordType> rowClassName={rowClassName}>
              {columns}
            </DataTableBody>
          </Table>
        </div>
      )}
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

DataTable.Col = DataTableColumn;
DataTable.NumberCol = DataTableNumberColumn;

const DataTableHead = ({ children }: { children: ReactNode }) => {
  const data = useDataTableDataContext();
  const { hasBulkActions = false } = useDataTableConfigContext();
  const { onSelect } = useDataTableCallbacksContext();
  const selectedIds = useDataTableSelectedIdsContext();
  const handleToggleSelectAll = (checked: boolean) => {
    if (!onSelect || !data || !selectedIds) return;
    onSelect(
      checked
        ? selectedIds.concat(
            data
              .filter((record) => !selectedIds.includes(record.id))
              .map((record) => record.id)
          )
        : []
    );
  };
  const selectableIds = Array.isArray(data)
    ? data.map((record) => record.id)
    : [];
  return (
    <TableHeader>
      <TableRow>
        {hasBulkActions ? (
          <TableHead className="w-8">
            <Checkbox
              onCheckedChange={handleToggleSelectAll}
              checked={
                selectedIds &&
                selectedIds.length > 0 &&
                selectableIds.length > 0 &&
                selectableIds.every((id) => selectedIds.includes(id))
              }
              className="mb-2"
            />
          </TableHead>
        ) : null}
        {children}
      </TableRow>
    </TableHeader>
  );
};

const DataTableBody = <RecordType extends RaRecord = RaRecord>({
  children,
  rowClassName,
}: {
  children: ReactNode;
  rowClassName?: (record: RecordType) => string | undefined;
}) => {
  const data = useDataTableDataContext();
  return (
    <TableBody>
      {data?.map((record, rowIndex) => (
        <RecordContextProvider
          value={record}
          key={record.id ?? `row${rowIndex}`}
        >
          <DataTableRow className={rowClassName?.(record)}>
            {children}
          </DataTableRow>
        </RecordContextProvider>
      ))}
    </TableBody>
  );
};

const DataTableRow = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { rowClick, handleToggleItem } = useDataTableCallbacksContext();
  const selectedIds = useDataTableSelectedIdsContext();
  const { hasBulkActions = false } = useDataTableConfigContext();

  const record = useRecordContext();
  if (!record) {
    throw new Error("DataTableRow can only be used within a RecordContext");
  }

  const resource = useResourceContext();
  if (!resource) {
    throw new Error("DataTableRow can only be used within a ResourceContext");
  }

  const navigate = useNavigate();
  const getPathForRecord = useGetPathForRecordCallback();

  const handleToggle = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!handleToggleItem) return;
      handleToggleItem(record.id, event);
    },
    [handleToggleItem, record.id]
  );

  const handleClick = useCallback(async () => {
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
  }, [record, resource, rowClick, navigate, getPathForRecord]);

  return (
    <TableRow
      key={record.id}
      onClick={handleClick}
      className={cn(rowClick !== false && "cursor-pointer", className)}
    >
      {hasBulkActions ? (
        <TableCell className="flex w-8" onClick={handleToggle}>
          <Checkbox
            checked={selectedIds?.includes(record.id)}
            onClick={handleToggle}
          />
        </TableCell>
      ) : null}
      {children}
    </TableRow>
  );
};

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function";

const DataTableEmpty = () => {
  return (
    <Alert>
      <AlertDescription>No results found.</AlertDescription>
    </Alert>
  );
};

export interface DataTableProps<RecordType extends RaRecord = RaRecord>
  extends Partial<DataTableBaseProps<RecordType>> {
  children: ReactNode;
  className?: string;
  rowClassName?: (record: RecordType) => string | undefined;
  bulkActionButtons?: ReactNode;
  bulkActionsToolbar?: ReactNode;
  mobileConfig?: MobileConfig;
}

export function DataTableColumn<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
>(props: DataTableColumnProps<RecordType>) {
  const renderContext = useDataTableRenderContext();
  switch (renderContext) {
    case "columnsSelector":
      return <ColumnsSelectorItem<RecordType> {...props} />;
    case "header":
      return <DataTableHeadCell {...props} />;
    case "data":
      return <DataTableCell {...props} />;
  }
}

/**
 * Reorder children based on columnRanks
 *
 * Note that columnRanks may be shorter than the number of children
 */
const reorderChildren = (children: ReactNode, columnRanks: number[]) =>
  Children.toArray(children).reduce((acc: ReactNode[], child, index) => {
    const rank = columnRanks.indexOf(index);
    if (rank === -1) {
      // if the column is not in columnRanks, keep it at the same index
      acc[index] = child;
    } else {
      // if the column is in columnRanks, move it to the rank index
      acc[rank] = child;
    }
    return acc;
  }, []);

function DataTableHeadCell<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
>(props: DataTableColumnProps<RecordType>) {
  const {
    disableSort,
    source,
    label,
    sortByOrder,
    className,
    headerClassName,
  } = props;

  const sort = useDataTableSortContext();
  const { handleSort } = useDataTableCallbacksContext();
  const resource = useResourceContext();
  const translate = useTranslate();
  const translateLabel = useTranslateLabel();
  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns] = useStore<string[]>(storeKey, defaultHiddenColumns);
  const isColumnHidden = hiddenColumns.includes(source!);
  if (isColumnHidden) return null;

  const nextSortOrder =
    sort && sort.field === source
      ? oppositeOrder[sort.order]
      : sortByOrder ?? "ASC";
  const fieldLabel = translateLabel({
    label: typeof label === "string" ? label : undefined,
    resource,
    source,
  });
  const sortLabel = translate("ra.sort.sort_by", {
    field: fieldLabel,
    field_lower_first:
      typeof fieldLabel === "string"
        ? fieldLabel.charAt(0).toLowerCase() + fieldLabel.slice(1)
        : undefined,
    order: translate(`ra.sort.${nextSortOrder}`),
    _: translate("ra.action.sort"),
  });

  return (
    <TableHead className={cn(className, headerClassName)}>
      {handleSort && sort && !disableSort && source ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 -mr-3 h-8 data-[state=open]:bg-accent cursor-pointer"
                data-field={source}
                onClick={handleSort}
              >
                {headerClassName?.includes("text-right") ? null : (
                  <FieldTitle
                    label={label}
                    source={source}
                    resource={resource}
                  />
                )}
                {sort.field === source ? (
                  sort.order === "ASC" ? (
                    <ArrowDownAZ className="ml-2 h-6 w-6" />
                  ) : (
                    <ArrowUpZA className="ml-2 h-6 w-6" />
                  )
                ) : null}
                {headerClassName?.includes("text-right") ? (
                  <FieldTitle
                    label={label}
                    source={source}
                    resource={resource}
                  />
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{sortLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <FieldTitle label={label} source={source} resource={resource} />
      )}
    </TableHead>
  );
}

const oppositeOrder: Record<SortPayload["order"], SortPayload["order"]> = {
  ASC: "DESC",
  DESC: "ASC",
};

function DataTableCell<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
>(props: DataTableColumnProps<RecordType>) {
  const {
    children,
    render,
    field,
    source,
    className,
    cellClassName,
    conditionalClassName,
  } = props;

  const { storeKey, defaultHiddenColumns } = useDataTableStoreContext();
  const [hiddenColumns] = useStore<string[]>(storeKey, defaultHiddenColumns);
  const record = useRecordContext<RecordType>();
  const isColumnHidden = hiddenColumns.includes(source!);
  if (isColumnHidden) return null;
  if (!render && !field && !children && !source) {
    throw new Error(
      "DataTableColumn: Missing at least one of the following props: render, field, children, or source"
    );
  }

  return (
    <TableCell
      className={cn(
        "py-1",
        className,
        cellClassName,
        record && conditionalClassName?.(record)
      )}
    >
      {children ??
        (render
          ? record && render(record)
          : field
          ? createElement(field, { source })
          : get(record, source!))}
    </TableCell>
  );
}

function DataTableMobileCell<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
>(props: DataTableColumnProps<RecordType>) {
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

  const content = children ??
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
}

export interface DataTableColumnProps<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
> {
  className?: string;
  cellClassName?: string;
  headerClassName?: string;
  conditionalClassName?: (record: RecordType) => string | false | undefined;
  children?: ReactNode;
  render?: (record: RecordType) => React.ReactNode;
  field?: React.ElementType;
  source?: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  label?: React.ReactNode;
  disableSort?: boolean;
  sortByOrder?: SortPayload["order"];
}

export function DataTableNumberColumn<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
>(props: DataTableNumberColumnProps<RecordType>) {
  const {
    source,
    options,
    locales,
    className,
    headerClassName,
    cellClassName,
    ...rest
  } = props;
  return (
    <DataTableColumn
      source={source}
      {...rest}
      className={className}
      headerClassName={cn("text-right", headerClassName)}
      cellClassName={cn("text-right", cellClassName)}
    >
      <NumberField source={source} options={options} locales={locales} />
    </DataTableColumn>
  );
}

export interface DataTableNumberColumnProps<
  RecordType extends RaRecord<Identifier> = RaRecord<Identifier>
> extends DataTableColumnProps<RecordType> {
  source: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  locales?: string | string[];
  options?: Intl.NumberFormatOptions;
}

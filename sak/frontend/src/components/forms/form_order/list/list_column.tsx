import { Children, isValidElement, type ReactNode } from "react";
import { RaRecord } from "ra-core";

import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import type { DataTableColumnProps } from "@/components/data-table";
import { ListLabel } from "./list_label";
import { ListBoolean, ListDate, ListNumber, ListText } from "./list_fields";

export type ListColumnProps<RecordType extends RaRecord = RaRecord> =
  DataTableColumnProps<RecordType> & {
    label?: ReactNode;
    widthClass?: string;
    width?: number | string;
    defaultWidthClass?: string;
  };

const findWidthFromChildren = (children: ReactNode): { widthClass?: string; width?: number | string } => {
  const nodes = Children.toArray(children);
  for (const node of nodes) {
    if (!isValidElement(node)) continue;
    const props = node.props as { widthClass?: string; style?: { width?: number | string }; children?: ReactNode };
    if (props.widthClass || props.style?.width != null) {
      return { widthClass: props.widthClass, width: props.style?.width };
    }
    if (props.children) {
      const nested = findWidthFromChildren(props.children);
      if (nested.widthClass || nested.width != null) {
        return nested;
      }
    }
  }
  return {};
};

export const ListColumn = <RecordType extends RaRecord = RaRecord>({
  label,
  widthClass,
  width,
  defaultWidthClass = "w-[160px]",
  ...props
}: ListColumnProps<RecordType>) => {
  const resolvedLabel =
    typeof label === "string" ? <ListLabel>{label}</ListLabel> : label;

  const inferred = findWidthFromChildren(props.children);
  const resolvedWidthClass = props.className ?? widthClass ?? inferred.widthClass ?? defaultWidthClass;
  const resolvedStyle = width != null ? { width } : inferred.width != null ? { width: inferred.width } : undefined;

  return (
    <ResponsiveDataTable.Col
      {...props}
      label={resolvedLabel}
      className={resolvedWidthClass}
      style={resolvedStyle}
    />
  );
};

export const TextListColumn = <RecordType extends RaRecord = RaRecord>({
  children,
  ...props
}: ListColumnProps<RecordType>) => (
  <ListColumn {...props} defaultWidthClass="w-[120px]">
    {children ?? <ListText source={props.source as string} />}
  </ListColumn>
);

export const NumberListColumn = <RecordType extends RaRecord = RaRecord>({
  children,
  ...props
}: ListColumnProps<RecordType>) => (
  <ListColumn {...props} defaultWidthClass="w-[90px]">
    {children ?? <ListNumber source={props.source as string} />}
  </ListColumn>
);

export const DateListColumn = <RecordType extends RaRecord = RaRecord>({
  children,
  ...props
}: ListColumnProps<RecordType>) => (
  <ListColumn {...props} defaultWidthClass="w-[90px]">
    {children ?? <ListDate source={props.source as string} />}
  </ListColumn>
);

export const BooleanListColumn = <RecordType extends RaRecord = RaRecord>({
  children,
  ...props
}: ListColumnProps<RecordType>) => (
  <ListColumn {...props} defaultWidthClass="w-[90px]">
    {children ?? <ListBoolean source={props.source as string} />}
  </ListColumn>
);

import * as React from "react";
import { useCallback } from "react";
import { Download } from "lucide-react";
import {
  fetchRelatedRecords,
  useDataProvider,
  useNotify,
  useListContext,
  Exporter,
  Translate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ExportButton = (props: ExportButtonProps) => {
  const {
    maxResults = 1000,
    onClick,
    label = "ra.action.export",
    icon = defaultIcon,
    exporter: customExporter,
    meta,
    className = "cursor-pointer",
    size,
  } = props;
  const resolvedSize = size ?? "sm";
  const resolvedClassName = cn(
    size == null && "h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm",
    className,
  );
  const {
    filter,
    filterValues,
    resource,
    sort,
    exporter: exporterFromContext,
    total,
  } = useListContext();
  const exporter = customExporter || exporterFromContext;
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      dataProvider
        .getList(resource, {
          sort,
          filter: filter ? { ...filterValues, ...filter } : filterValues,
          pagination: { page: 1, perPage: maxResults },
          meta,
        })
        .then(
          ({ data }) =>
            exporter &&
            exporter(
              data,
              fetchRelatedRecords(dataProvider),
              dataProvider,
              resource,
            ),
        )
        .catch((error) => {
          console.error(error);
          notify("HTTP Error", { type: "error" });
        });
      if (typeof onClick === "function") {
        onClick(event);
      }
    },
    [
      dataProvider,
      exporter,
      filter,
      filterValues,
      maxResults,
      notify,
      onClick,
      resource,
      sort,
      meta,
    ],
  );

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={total === 0}
      className={resolvedClassName}
      size={resolvedSize}
    >
      {icon}
      <Translate i18nKey={label}>Export</Translate>
    </Button>
  );
};

const defaultIcon = <Download />;

export interface ExportButtonProps {
  className?: string;
  exporter?: Exporter;
  icon?: React.ReactNode;
  label?: string;
  maxResults?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  resource?: string;
  meta?: Record<string, unknown>;
  size?: "default" | "sm" | "lg" | "icon";
}

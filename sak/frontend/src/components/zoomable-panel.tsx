"use client";

import { useRef, type ReactNode } from "react";
import { Download, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ZoomablePanelProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  zoomChildren?: ReactNode;
  exportData?: {
    filename: string;
    columns: string[];
    rows: Array<Array<string | number | null | undefined>>;
  };
  className?: string;
  contentClassName?: string;
  zoomContentClassName?: string;
};

const escapeCsvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsvForExcel = (
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>,
) => {
  const csv = [columns, ...rows]
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const INLINE_STYLE_PROPERTIES = [
  "backgroundColor",
  "borderBottomColor",
  "borderBottomStyle",
  "borderBottomWidth",
  "borderLeftColor",
  "borderLeftStyle",
  "borderLeftWidth",
  "color",
  "fontSize",
  "fontWeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "textAlign",
  "verticalAlign",
  "whiteSpace",
];

const toKebabCase = (value: string) =>
  value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const inlineComputedTableStyles = (source: HTMLElement, target: HTMLElement) => {
  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const targetElements = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))];

  sourceElements.forEach((sourceElement, index) => {
    const targetElement = targetElements[index];
    if (!targetElement) return;

    const computed = window.getComputedStyle(sourceElement);
    const inlineStyle = INLINE_STYLE_PROPERTIES
      .map((property) => `${toKebabCase(property)}:${computed.getPropertyValue(toKebabCase(property))}`)
      .join(";");
    targetElement.setAttribute("style", `${inlineStyle};mso-number-format:\\@;`);
  });
};

const downloadRenderedTableForExcel = (filename: string, title: string, table: HTMLTableElement) => {
  const clonedTable = table.cloneNode(true) as HTMLTableElement;
  inlineComputedTableStyles(table, clonedTable);
  clonedTable.setAttribute(
    "style",
    `${clonedTable.getAttribute("style") ?? ""};width:100%;border-collapse:collapse;table-layout:fixed;`,
  );

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 12px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${clonedTable.outerHTML}
</body>
</html>`;
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.(csv|xlsx?)$/i, ".xls");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const ZoomablePanel = ({
  title,
  subtitle,
  children,
  zoomChildren,
  exportData,
  className,
  contentClassName,
  zoomContentClassName,
}: ZoomablePanelProps) => {
  const zoomContentRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    const table = zoomContentRef.current?.querySelector("table");
    if (table) {
      downloadRenderedTableForExcel(exportData?.filename ?? `${title}.xls`, title, table);
      return;
    }

    if (exportData) {
      downloadCsvForExcel(exportData.filename, exportData.columns, exportData.rows);
    }
  };

  return (
  <Dialog>
    <div
      className={cn(
        "min-h-0 w-full overflow-hidden rounded-lg border border-border/70 bg-white shadow-sm",
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 truncate text-xs font-semibold">{title}</div>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-[18px] w-[18px] rounded px-0 text-slate-500 hover:text-slate-900"
              title={`Ampliar ${title}`}
              aria-label={`Ampliar ${title}`}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </DialogTrigger>
        </div>
        {subtitle ? <div className="min-w-0 shrink-0 truncate text-[8px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
    </div>
    <DialogContent className="grid h-[72vh] !w-[96vw] !max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
      <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
        <DialogTitle className="truncate text-sm">{title}</DialogTitle>
        {exportData ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={handleExport}
          >
            <Download className="h-3 w-3" />
            Excel
          </Button>
        ) : null}
      </DialogHeader>
      <div ref={zoomContentRef} className={cn("flex min-h-0 flex-col overflow-auto", zoomContentClassName)}>
        {zoomChildren ?? children}
      </div>
    </DialogContent>
  </Dialog>
  );
};

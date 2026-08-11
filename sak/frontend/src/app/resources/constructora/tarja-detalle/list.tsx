"use client";

import { useRef, type RefObject } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useListContext } from "ra-core";
import { ArrowLeft, Download, Loader2, TableProperties } from "lucide-react";

import { List, LIST_CONTAINER_2XL } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { buildListFilters, ListPaginator } from "@/components/forms/form_order";
import { CompactSoloActivasToggleFilter } from "@/components/forms/form_order/list/solo_activas_toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TarjaDetalleCell = {
  detalle_id?: number | null;
  fecha?: string | null;
  horas?: number | null;
  idestado?: number | null;
  estado?: string | null;
  descripcion?: string | null;
};

type DayKey =
  | "D01"
  | "D02"
  | "D03"
  | "D04"
  | "D05"
  | "D06"
  | "D07"
  | "D08"
  | "D09"
  | "D10"
  | "D11"
  | "D12"
  | "D13"
  | "D14"
  | "D15";

type TarjaDetalleRow = {
  id: string;
  tarja_id: number | string;
  obra?: string | null;
  idnomina: number | string;
  empleado: string;
  dni?: string | null;
} & Record<DayKey, TarjaDetalleCell>;

const dayKeys = Array.from(
  { length: 15 },
  (_, index) => `D${String(index + 1).padStart(2, "0")}` as DayKey,
);

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar empleado",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="novedades"
          source="novedades"
          label="Novedades"
          alwaysOn
          className="w-[92px]"
        />
      ),
    },
  ],
  { keyPrefix: "tarja-detalle" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const INLINE_STYLE_PROPERTIES = [
  "backgroundColor",
  "borderBottomColor",
  "borderBottomStyle",
  "borderBottomWidth",
  "borderLeftColor",
  "borderLeftStyle",
  "borderLeftWidth",
  "borderRightColor",
  "borderRightStyle",
  "borderRightWidth",
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

const downloadRenderedTableForExcel = (
  filename: string,
  title: string,
  table: HTMLTableElement,
) => {
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
    th, td { border: 1px solid #e5e7eb; }
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

const buildSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

const formatDayLabel = (cell?: TarjaDetalleCell, fallback?: string) => {
  const date = String(cell?.fecha ?? "").slice(0, 10);
  if (!date) return fallback ?? "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
};

const formatDayName = (cell?: TarjaDetalleCell, fallback?: string) => {
  const date = String(cell?.fecha ?? "").slice(0, 10);
  if (!date) return fallback ?? "";
  const dayName = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  return dayName.replace(".", "").slice(0, 3);
};

const isNonWorkingDay = (dateValue?: string | null) => {
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0;
};

const TarjaDetalleHorasCell = ({ cell }: { cell?: TarjaDetalleCell }) => {
  const horas = cell?.horas;
  return (
    <span className="block min-h-4 text-center text-[9px] font-medium leading-4 text-slate-700">
      {horas == null ? "" : Number(horas).toLocaleString("es-AR", { maximumFractionDigits: 1 })}
    </span>
  );
};

const shouldShowEstado = (estado?: string | null) => {
  const normalized = String(estado ?? "").trim().toUpperCase();
  return Boolean(normalized && normalized !== "P");
};

const TarjaDetalleTitle = ({
  id,
  onBack,
}: {
  id?: string;
  onBack: () => void;
}) => {
  const { data = [] } = useListContext<TarjaDetalleRow>();
  const obra = (data as TarjaDetalleRow[])[0]?.obra;

  return (
    <>
      <div className="sm:hidden">
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-1.5 text-[11px] font-medium text-primary"
          onClick={onBack}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Volver
        </Button>
        <div className="-mt-0.5 flex min-w-0 items-center justify-center gap-1">
          <TableProperties className="size-4 shrink-0" />
          <span>Tarja Detalle #{id}</span>
        </div>
        {obra ? (
          <div className="truncate text-center text-xs font-medium text-slate-500">
            {obra}
          </div>
        ) : null}
      </div>
      <span className="hidden min-w-0 items-center gap-3 sm:inline-flex">
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-sm font-medium text-primary"
          onClick={onBack}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Volver
        </Button>
        <TableProperties className="size-5 shrink-0" />
        <span>Tarja Detalle #{id}</span>
        {obra ? (
          <span className="truncate text-sm font-medium text-slate-500">{obra}</span>
        ) : null}
      </span>
    </>
  );
};

const TarjaDetalleActions = ({
  tableRef,
  tarjaId,
}: {
  tableRef: RefObject<HTMLTableElement | null>;
  tarjaId?: string;
}) => {
  const { data = [] } = useListContext<TarjaDetalleRow>();
  const rows = data as TarjaDetalleRow[];
  const obra = rows[0]?.obra ?? "";

  const handleExport = () => {
    const table = tableRef.current;
    if (!table) return;
    const title = ["Tarja Detalle", tarjaId ? `#${tarjaId}` : "", obra]
      .filter(Boolean)
      .join(" - ");
    const filename = buildSafeFilename(title || "tarja-detalle");
    downloadRenderedTableForExcel(`${filename}.xls`, title, table);
  };

  return (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={LIST_FILTERS}
        size="sm"
        buttonClassName={ACTION_BUTTON_CLASS}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={ACTION_BUTTON_CLASS}
        disabled={!rows.length}
        onClick={handleExport}
        title="Exportar a XLS"
      >
        <Download className="size-3.5" />
        XLS
      </Button>
    </div>
  );
};

const TarjaDetalleGrid = ({
  tableRef,
}: {
  tableRef: RefObject<HTMLTableElement | null>;
}) => {
  const { data = [], isLoading, isFetching, error } = useListContext<TarjaDetalleRow>();
  const rows = data as TarjaDetalleRow[];
  const firstRow = rows[0];

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
        No se pudo cargar el detalle de la tarja.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      {isLoading || isFetching ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
            <Loader2 className="size-3.5 animate-spin" />
            Cargando detalle
          </span>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table ref={tableRef} className="min-w-[720px] w-full border-collapse text-[10px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold">
                Empleado
              </th>
              {dayKeys.map((key) => {
                const cell = firstRow?.[key];
                const nonWorking = isNonWorkingDay(cell?.fecha);
                return (
                  <th
                    key={key}
                    className={cn(
                      "w-[34px] border-b border-r border-slate-200 px-0.5 py-1 text-center font-semibold",
                      nonWorking && "bg-rose-50 text-rose-700",
                    )}
                  >
                    <span className="block text-[9px] leading-tight">
                      {formatDayName(cell, key)}
                    </span>
                    <span className="block text-[7px] font-normal leading-tight text-slate-400">
                      {formatDayLabel(cell, key)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="sticky left-0 z-10 max-w-[170px] border-r border-slate-200 bg-white px-2 py-1.5">
                    <span className="block truncate font-medium text-slate-800">{row.empleado}</span>
                    <span className="block text-[9px] text-slate-400">{row.dni}</span>
                  </td>
                  {dayKeys.map((key) => {
                    const cell = row[key];
                    const nonWorking = isNonWorkingDay(cell?.fecha);
                    return (
                      <td
                        key={key}
                        className={cn(
                          "border-r border-slate-100 px-0.5 py-0.5 align-top",
                          nonWorking && "bg-rose-50/60",
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <TarjaDetalleHorasCell cell={cell} />
                          {shouldShowEstado(cell?.estado) ? (
                            <span className="rounded bg-amber-100 px-0.5 text-[7px] font-semibold leading-3 text-amber-700">
                              {cell.estado}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-sm text-slate-400">
                  Sin detalle para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TarjaDetalleList = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || "/tarjas/panel";

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/tarjas/panel");
  };

  return (
    <List
      resource="tarja-detalle"
      title={<TarjaDetalleTitle id={id} onBack={handleBack} />}
      filters={LIST_FILTERS}
      actions={<TarjaDetalleActions tableRef={tableRef} tarjaId={id} />}
      filter={{ tarja_id: Number(id) }}
      perPage={10}
      pagination={<ListPaginator />}
      sort={{ field: "empleado", order: "ASC" }}
      containerClassName={LIST_CONTAINER_2XL}
    >
      <TarjaDetalleGrid tableRef={tableRef} />
    </List>
  );
};

export default TarjaDetalleList;

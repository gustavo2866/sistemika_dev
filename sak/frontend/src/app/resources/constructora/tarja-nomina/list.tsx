"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  RecordContextProvider,
  useCreatePath,
  useDataProvider,
  useGetOne,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { ArrowLeft, ArrowRightLeft, FileText, Loader2, Pencil, TableProperties } from "lucide-react";

import { List, LIST_CONTAINER_XL } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import {
  FormOrderListRowActions,
  ListPaginator,
  buildListFilters,
} from "@/components/forms/form_order";
import { CompactSoloActivasToggleFilter } from "@/components/forms/form_order/list/solo_activas_toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TarjaNomina } from "./model";

type TarjaNominaDayCell = {
  detalle_id?: number | null;
  fecha?: string | null;
  horas?: number | null;
  idestado?: number | null;
  estado?: string | null;
  estado_nombre?: string | null;
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
  | "D15"
  | "D16";

type TarjaNominaRecord = TarjaNomina & Partial<Record<DayKey, TarjaNominaDayCell>> & {
  empleado?: string | null;
  dni?: string | null;
  categoria_codigo?: string | null;
  actividad_codigo?: string | null;
  obra?: string | null;
  encargado?: string | null;
  proyecto_id?: number | null;
  encargado_id?: number | null;
  tarja_fecha_desde?: string | null;
  tarja_fecha_hasta?: string | null;
};

const allDayKeys = Array.from(
  { length: 16 },
  (_, index) => `D${String(index + 1).padStart(2, "0")}` as DayKey,
);
const getVisibleDayKeys = (rows: TarjaNominaRecord[]) =>
  allDayKeys.filter((key) => key !== "D16" || rows.some((row) => row.D16 !== undefined));

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar empleado",
        alwaysOn: true,
        className: "w-[150px] sm:w-[210px]",
      },
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="bonos"
          source="bonos"
          label="Bonos"
          alwaysOn
          className="w-[92px]"
        />
      ),
    },
    {
      type: "custom",
      element: (
        <CompactSoloActivasToggleFilter
          key="parte-novedades"
          source="parte_novedades"
          label="Novedades"
          alwaysOn
          className="w-[106px]"
        />
      ),
    },
  ],
  { keyPrefix: "tarja-nomina" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type TarjaNominaListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
  createTo?: string;
};

const formatDate = (value?: string | null) => {
  const date = String(value ?? "").slice(0, 10);
  if (!date) return "-";
  const [, month, day] = date.split("-");
  return day && month ? `${day}/${month}` : date;
};

const formatDayName = (cell?: TarjaNominaDayCell, fallback?: string) => {
  const date = String(cell?.fecha ?? "").slice(0, 10);
  if (!date) return fallback ?? "";
  const dayName = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  return dayName.replace(".", "").slice(0, 3);
};

const formatDayLabel = (cell?: TarjaNominaDayCell, fallback?: string) => {
  const date = String(cell?.fecha ?? "").slice(0, 10);
  if (!date) return fallback ?? "";
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
};

const isNonWorkingDay = (dateValue?: string | null) => {
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return false;
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
};

const formatHours = (value?: number | null) =>
  Number(value ?? 0).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  });

const getWorkedHours = (cell?: TarjaNominaDayCell) => {
  const hours = Number(cell?.horas ?? 0);
  return Number.isFinite(hours) ? hours : 0;
};

const getRowWorkedHours = (record?: TarjaNominaRecord) =>
  allDayKeys.reduce((total, key) => total + getWorkedHours(record?.[key]), 0);

const shouldShowEstado = (estado?: string | null) => {
  const normalized = String(estado ?? "").trim().toUpperCase();
  return Boolean(normalized && normalized !== "P");
};

const formatAmount = (value?: number | null) =>
  Number(value ?? 0).toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  });

const hasAmount = (value?: number | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount !== 0;
};

const getFilterTarjaId = (filterValues?: Record<string, unknown>) => {
  const raw = filterValues?.tarja_id;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
};

const toPdfSafeText = (value?: string | number | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const truncatePdfText = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(maxLength - 1, 0))}.`
    : value;

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const buildPdfDocument = (pages: string[]) => {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  pages.forEach((content, index) => {
    const contentObjectNumber = 5 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  const parts = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(parts.join("").length);
    parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = parts.join("").length;
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  parts.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
  return parts.join("");
};

const buildSafeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

const downloadTarjaNominaPdf = (
  filename: string,
  title: string,
  rows: TarjaNominaRecord[],
) => {
  const visibleDayKeys = getVisibleDayKeys(rows);
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 18;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  const rowHeight = 18;
  const tableTop = pageHeight - 48;
  const rowsPerPage = Math.max(
    Math.floor((tableTop - margin - headerHeight) / rowHeight),
    1,
  );
  const columns = [
    { label: "Empleado", width: 112, align: "left", size: 5.8, max: 24, key: "empleado" },
    ...visibleDayKeys.map((key) => ({
      label: `${formatDayName(rows[0]?.[key])} ${formatDayLabel(rows[0]?.[key])}`,
      width: 24,
      align: "center",
      size: 5.2,
      max: 7,
      dayKey: key,
    })),
    { label: "Categ", width: 28, align: "center", size: 5.2, max: 6, key: "categoria" },
    { label: "Act", width: 28, align: "center", size: 5.2, max: 6, key: "actividad" },
    { label: "Horas", width: 36, align: "center", size: 5.8, max: 8, key: "horas" },
    { label: "Pres", width: 42, align: "center", size: 5.2, max: 14, key: "presentismo" },
    { label: "Bonos", width: 62, align: "center", size: 5.2, max: 16, key: "bonos" },
    {
      label: "Coment",
      width: tableWidth - 112 - 24 * visibleDayKeys.length - 28 - 28 - 36 - 42 - 62,
      align: "left",
      size: 5.2,
      max: 34,
      key: "comentario",
    },
  ] as const;

  const getCellText = (
    row: TarjaNominaRecord,
    column: (typeof columns)[number],
  ) => {
    if ("dayKey" in column) {
      const cell = row[column.dayKey];
      const hours = cell?.horas == null ? "" : formatHours(Number(cell.horas));
      const status = shouldShowEstado(cell?.estado)
        ? String(cell?.estado ?? "")
        : "";
      return [hours, status].filter(Boolean).join(" ");
    }

    const workedHours = getRowWorkedHours(row);
    const justifiedHours = Number(row.horas_justificadas ?? 0);
    const totalBonus =
      Number(row.adicional_importe ?? 0) + Number(row.premio_importe ?? 0);

    switch (column.key) {
      case "categoria":
        return row.categoria_codigo ?? "";
      case "actividad":
        return row.actividad_codigo ?? "";
      case "horas":
        return formatHours(workedHours + justifiedHours);
      case "presentismo":
        return `${row.presentismo ? "SI" : "NO"} trab:${formatHours(workedHours)} just:${formatHours(justifiedHours)}`;
      case "bonos":
        return formatAmount(totalBonus);
      case "comentario":
        return row.observaciones ?? "";
      default:
        return [row.empleado, row.dni].filter(Boolean).join(" ");
    }
  };

  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = "0 g",
  ) =>
    `${color} BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${toPdfSafeText(value)}) Tj ET\n`;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `0.82 G ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  const fillRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    rgb: string,
  ) =>
    `q ${rgb} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;

  const pageRows = Array.from(
    { length: Math.max(Math.ceil(rows.length / rowsPerPage), 1) },
    (_, index) => rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
  );
  const columnPositions = columns.reduce<number[]>((positions, column) => {
    const previous = positions[positions.length - 1] ?? margin;
    positions.push(previous + column.width);
    return positions;
  }, [margin]);

  const addGridLines = (content: string, rowCount: number) => {
    const bottom = tableTop - headerHeight - rowCount * rowHeight;
    columnPositions.forEach((x) => {
      content += line(x, tableTop, x, bottom);
    });
    for (let index = 0; index <= rowCount; index += 1) {
      const y = tableTop - headerHeight - index * rowHeight;
      content += line(margin, y, margin + tableWidth, y);
    }
    content += line(margin, tableTop, margin + tableWidth, tableTop);
    return content;
  };

  const addSignatureArea = (content: string, rowCount: number) => {
    const signatureY = tableTop - headerHeight - rowCount * rowHeight - 40;
    const lineWidth = 210;
    const managerX = margin + 90;
    const engineerX = margin + tableWidth - lineWidth - 90;
    content += line(managerX, signatureY, managerX + lineWidth, signatureY);
    content += line(engineerX, signatureY, engineerX + lineWidth, signatureY);
    content += text("Firma encargado", managerX + 70, signatureY - 12, 7);
    content += text("Firma ingeniero", engineerX + 72, signatureY - 12, 7);
    return content;
  };

  const pages = pageRows.map((currentRows, pageIndex) => {
    const isLastPage = pageIndex === pageRows.length - 1;
    const tableBottom = tableTop - headerHeight - currentRows.length * rowHeight;
    let content = "0.82 G 0.4 w\n";
    content += text(title, margin, pageHeight - 26, 11);
    content += text(
      `Pagina ${pageIndex + 1}`,
      pageWidth - margin - 42,
      pageHeight - 26,
      6,
    );

    currentRows.forEach((_row, rowIndex) => {
      if (rowIndex % 2 === 0) return;
      const rowTop = tableTop - headerHeight - rowIndex * rowHeight;
      content += fillRect(
        margin,
        rowTop - rowHeight,
        tableWidth,
        rowHeight,
        "0.98 0.98 0.98",
      );
    });
    columns.forEach((column, columnIndex) => {
      if (
        !("dayKey" in column) ||
        !isNonWorkingDay(rows[0]?.[column.dayKey]?.fecha)
      ) {
        return;
      }
      content += fillRect(
        columnPositions[columnIndex],
        tableBottom,
        column.width,
        currentRows.length * rowHeight,
        "0.90 0.90 0.90",
      );
    });
    content += fillRect(
      margin,
      tableTop - headerHeight,
      tableWidth,
      headerHeight,
      "0 0 0",
    );

    let x = margin;
    columns.forEach((column) => {
      content += text(
        truncatePdfText(column.label, column.max),
        x + 2,
        tableTop - 12,
        5.2,
        "1 g",
      );
      x += column.width;
    });
    currentRows.forEach((row, rowIndex) => {
      const rowBottom =
        tableTop - headerHeight - rowIndex * rowHeight - rowHeight;
      let cellX = margin;
      columns.forEach((column) => {
        const value = truncatePdfText(getCellText(row, column), column.max);
        const approximateWidth = value.length * column.size * 0.48;
        const textX =
          column.align === "center"
            ? cellX + Math.max((column.width - approximateWidth) / 2, 1)
            : cellX + 2;
        content += text(value, textX, rowBottom + 6, column.size);
        cellX += column.width;
      });
    });
    content = addGridLines(content, currentRows.length);
    if (isLastPage && tableBottom - 52 >= margin) {
      content = addSignatureArea(content, currentRows.length);
    }
    return content;
  });

  if (rows.length) {
    const lastPageRows = pageRows[pageRows.length - 1]?.length ?? 0;
    const lastTableBottom = tableTop - headerHeight - lastPageRows * rowHeight;
    if (lastTableBottom - 52 < margin) {
      let signaturePage = "0.82 G 0.4 w\n";
      signaturePage += text(title, margin, pageHeight - 26, 11);
      signaturePage += text(
        `Pagina ${pages.length + 1}`,
        pageWidth - margin - 42,
        pageHeight - 26,
        6,
      );
      signaturePage = addSignatureArea(signaturePage, 0);
      pages.push(signaturePage);
    }
  }

  downloadBlob(
    filename,
    new Blob([buildPdfDocument(pages)], { type: "application/pdf" }),
  );
};

const ListActions = ({ createTo }: { createTo?: string }) => {
  const dataProvider = useDataProvider();
  const { data = [], filterValues, sort, total } =
    useListContext<TarjaNominaRecord>();
  const [isExporting, setIsExporting] = useState(false);
  const rows = data as TarjaNominaRecord[];
  const firstRow = rows[0];
  const tarjaId = getFilterTarjaId(filterValues);
  const { data: tarja } = useGetOne<{
    id: number;
    idproyecto?: number | null;
    contacto_id?: number | null;
    fechainicio?: string | null;
    fechafinal?: string | null;
  }>(
    "tarjas",
    { id: tarjaId as number },
    { enabled: Boolean(tarjaId) },
  );
  const resolvedCreateTo = useMemo(() => {
    const target = createTo || "/tarja-nomina/create";
    const [pathname, query = ""] = target.split("?", 2);
    const params = new URLSearchParams(query);
    if (tarjaId) params.set("tarja_id", String(tarjaId));
    const proyectoId = firstRow?.proyecto_id ?? tarja?.idproyecto;
    const encargadoId = firstRow?.encargado_id ?? tarja?.contacto_id;
    const fechaDesde = firstRow?.tarja_fecha_desde ?? tarja?.fechainicio;
    const fechaHasta = firstRow?.tarja_fecha_hasta ?? tarja?.fechafinal;
    if (proyectoId) {
      params.set("proyecto_id", String(proyectoId));
    }
    if (encargadoId) {
      params.set("encargado_id", String(encargadoId));
    }
    if (firstRow?.obra) params.set("obra", firstRow.obra);
    if (firstRow?.encargado) params.set("encargado", firstRow.encargado);
    if (fechaDesde) {
      params.set("fecha_desde", fechaDesde);
    }
    if (fechaHasta) {
      params.set("fecha_hasta", fechaHasta);
    }
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [createTo, firstRow, tarja, tarjaId]);

  const handlePdfExport = async () => {
    const tarjaId = getFilterTarjaId(filterValues);
    const obra = rows[0]?.obra ?? "";
    const title = ["Tarja Nomina", tarjaId ? `#${tarjaId}` : "", obra]
      .filter(Boolean)
      .join(" - ");
    setIsExporting(true);
    try {
      const response = await dataProvider.getList<TarjaNominaRecord>(
        "tarja-nomina",
        {
          filter: filterValues ?? {},
          pagination: {
            page: 1,
            perPage: typeof total === "number" && total > 0 ? total : 1000,
          },
          sort: {
            field: sort?.field ?? "id",
            order: sort?.order ?? "ASC",
          },
        },
      );
      downloadTarjaNominaPdf(
        `${buildSafeFilename(title || "tarja-nomina")}.pdf`,
        title,
        response.data as TarjaNominaRecord[],
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterButton
        filters={LIST_FILTERS}
        size="sm"
        buttonClassName={ACTION_BUTTON_CLASS}
      />
      <CreateButton
        className={cn(ACTION_BUTTON_CLASS, "shrink-0")}
        label="Crear"
        to={resolvedCreateTo}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={ACTION_BUTTON_CLASS}
        disabled={!rows.length || isExporting}
        onClick={handlePdfExport}
        title="Exportar PDF"
      >
        {isExporting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileText className="size-3.5" />
        )}
        Exportar
      </Button>
    </div>
  );
};

const TarjaNominaTitle = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data = [], filterValues } = useListContext<TarjaNominaRecord>();
  const firstRow = (data as TarjaNominaRecord[])[0];
  const tarjaId = getFilterTarjaId(filterValues);
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

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

  const obra = firstRow?.obra ?? "-";
  const encargado = firstRow?.encargado ?? "-";

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {!embedded ? (
          <Button
            type="button"
            variant="ghost"
            className="h-7 shrink-0 px-1.5 text-[11px] font-medium text-primary sm:h-8 sm:px-2 sm:text-sm"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Volver
          </Button>
        ) : null}
        <TableProperties className="size-5 shrink-0" />
        <span className="truncate">Tarja Nomina</span>
      </div>
      {tarjaId ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500 sm:text-[11px]">
          <span className="whitespace-nowrap">Tarja #{tarjaId}</span>
          <span className="whitespace-nowrap">
            Fecha {`${formatDate(firstRow?.tarja_fecha_desde)} - ${formatDate(firstRow?.tarja_fecha_hasta)}`}
          </span>
          <span className="max-w-[260px] truncate">Obra {obra}</span>
          <span className="max-w-[220px] truncate">Encargado {encargado}</span>
        </div>
      ) : null}
    </div>
  );
};

const EmpleadoCell = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  const nominaId = record?.nomina_id ?? undefined;
  const label = record?.empleado || (nominaId ? `Empleado #${nominaId}` : "Sin empleado");

  return (
    <div className="min-w-0">
      <span className="block truncate text-[10px] font-semibold text-slate-800 sm:text-[11px]">
        {label}
      </span>
      <span className="block truncate text-[8px] text-slate-400">
        {record?.dni ?? ""}
      </span>
    </div>
  );
};

const RelatedCodeCell = ({
  recordField,
}: {
  recordField: "categoria_codigo" | "actividad_codigo";
}) => {
  const record = useRecordContext<TarjaNominaRecord>();
  const value = record?.[recordField] ?? "";
  return (
    <span className="block text-center text-[8px] font-semibold leading-4 text-slate-600">
      {value}
    </span>
  );
};

const DayHoursCell = ({ cell }: { cell?: TarjaNominaDayCell }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="block min-h-4 text-center text-[9px] font-medium leading-4 text-slate-700">
      {cell?.horas == null ? "" : formatHours(Number(cell.horas))}
    </span>
    {shouldShowEstado(cell?.estado) ? (
      <span className="rounded bg-amber-100 px-0.5 text-[7px] font-semibold leading-3 text-amber-700">
        {cell?.estado}
      </span>
    ) : null}
  </div>
);

const TotalHoursCell = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  const total = getRowWorkedHours(record) + Number(record?.horas_justificadas ?? 0);
  return (
    <span className="block text-center text-[9px] font-medium leading-4 tabular-nums text-slate-800">
      {formatHours(total)}
    </span>
  );
};

const PresentismoCell = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  const workedHours = getRowWorkedHours(record);
  const justifiedHours = Number(record?.horas_justificadas ?? 0);
  return (
    <div className="text-center text-slate-800">
      <span className="block text-[8px] font-semibold leading-3">
        {record?.presentismo ? "SI" : "NO"}
      </span>
      <span className="block text-[6.5px] font-medium leading-[8px] text-slate-500 tabular-nums">
        trab: {formatHours(workedHours)}
      </span>
      <span className="block text-[6.5px] font-medium leading-[8px] text-amber-700 tabular-nums">
        just: {formatHours(justifiedHours)}
      </span>
    </div>
  );
};

const AmountCell = ({ sources }: { sources: Array<keyof TarjaNominaRecord> }) => {
  const record = useRecordContext<TarjaNominaRecord>();
  const total = sources.reduce((sum, source) => sum + Number(record?.[source] ?? 0), 0);
  return (
    <div className="text-center tabular-nums text-slate-800">
      <span className="block text-[10px] font-semibold leading-4">{formatAmount(total)}</span>
      {sources.map((source) => {
        const value = Number(record?.[source] ?? 0);
        if (!hasAmount(value)) return null;
        const label = String(source)
          .replace("_importe", "")
          .replace(/_/g, " ");
        return (
          <span key={String(source)} className="block text-[6.5px] font-medium leading-[8px] text-slate-500">
            {label}: {formatAmount(value)}
          </span>
        );
      })}
    </div>
  );
};

const ObservacionesCell = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  return (
    <span className="block max-h-[28px] overflow-hidden break-words text-[8px] leading-[9px] text-slate-600">
      {record?.observaciones ?? ""}
    </span>
  );
};

const EditRowMenuItem = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const location = useLocation();

  if (!record?.id) return null;
  if (record.tipo_novedad === "ALT" || record.editable === false) return null;

  return (
    <DropdownMenuItem
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const returnTo = `${location.pathname}${location.search}`;
        const params = new URLSearchParams({ returnTo });
        navigate(`${createPath({ resource: "tarja-nomina", type: "edit", id: record.id })}?${params.toString()}`);
      }}
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <Pencil className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Editar
    </DropdownMenuItem>
  );
};

const TransferRowMenuItem = () => {
  const record = useRecordContext<TarjaNominaRecord>();
  const navigate = useNavigate();
  const location = useLocation();

  if (!record?.id || !record.nomina_id) return null;

  return (
    <DropdownMenuItem
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const returnTo = `${location.pathname}${location.search}`;
        const params = new URLSearchParams({ returnTo });
        navigate(`/tarja-nomina/${record.id}/trasladar?${params.toString()}`);
      }}
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <ArrowRightLeft className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Trasladar
    </DropdownMenuItem>
  );
};

const TarjaNominaGrid = () => {
  const { data = [], isLoading, isFetching, error } = useListContext<TarjaNominaRecord>();
  const rows = data as TarjaNominaRecord[];
  const firstRow = rows[0];
  const visibleDayKeys = getVisibleDayKeys(rows);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
        No se pudo cargar la nomina de la tarja.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      {isLoading || isFetching ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
            <Loader2 className="size-3.5 animate-spin" />
            Cargando nomina
          </span>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[10px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 w-[112px] border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-left font-semibold">
                Empleado
              </th>
              {visibleDayKeys.map((key) => {
                const cell = firstRow?.[key];
                const nonWorking = isNonWorkingDay(cell?.fecha);
                return (
                  <th
                    key={key}
                    className={cn(
                      "w-[23px] border-b border-r border-slate-200 px-0 py-1 text-center font-semibold",
                      nonWorking && "bg-rose-50 text-rose-700",
                    )}
                  >
                    <span className="block text-[7px] leading-tight">
                      {formatDayName(cell)}
                    </span>
                    <span className="block text-[5.5px] font-normal leading-tight text-slate-400">
                      {formatDayLabel(cell)}
                    </span>
                  </th>
                );
              })}
              <th className="w-[28px] border-b border-r border-slate-200 px-0.5 py-1 text-center text-[7px] font-semibold">
                Categ
              </th>
              <th className="w-[28px] border-b border-r border-slate-200 px-0.5 py-1 text-center text-[7px] font-semibold">
                Act
              </th>
              <th className="w-[36px] border-b border-r border-slate-200 px-0.5 py-1 text-center font-semibold">
                Horas
              </th>
              <th className="w-[46px] border-b border-r border-slate-200 px-0.5 py-1 text-center font-semibold">
                Pres
              </th>
              <th className="w-[52px] border-b border-r border-slate-200 px-0.5 py-1 text-center font-semibold">
                Bonos
              </th>
              <th className="w-[86px] border-b border-slate-200 px-1 py-1 text-left font-semibold">
                Coment
              </th>
              <th className="w-[28px] border-b border-slate-200 px-0.5 py-1" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <RecordContextProvider key={row.id} value={row}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="sticky left-0 z-10 max-w-[112px] border-r border-slate-200 bg-white px-1 py-1.5">
                      <EmpleadoCell />
                    </td>
                    {visibleDayKeys.map((key) => {
                      const cell = row[key];
                      const nonWorking = isNonWorkingDay(cell?.fecha);
                      return (
                        <td
                          key={key}
                          className={cn(
                            "w-[23px] border-r border-slate-100 px-0 py-0.5 align-top",
                            nonWorking && "bg-rose-50/60",
                          )}
                        >
                          <DayHoursCell cell={cell} />
                        </td>
                      );
                    })}
                    <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top">
                      <RelatedCodeCell
                        recordField="categoria_codigo"
                      />
                    </td>
                    <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top">
                      <RelatedCodeCell
                        recordField="actividad_codigo"
                      />
                    </td>
                    <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top">
                      <TotalHoursCell />
                    </td>
                    <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top">
                      <PresentismoCell />
                    </td>
                    <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top">
                      <AmountCell sources={["adicional_importe", "premio_importe"]} />
                    </td>
                    <td className="w-[86px] max-w-[86px] border-r border-slate-200 bg-slate-50 px-1 py-1 align-top">
                      <ObservacionesCell />
                    </td>
                    <td className="bg-slate-50 px-0.5 py-1 text-center align-middle">
                      <FormOrderListRowActions
                        showShow
                        extraMenuItems={
                          <>
                            <EditRowMenuItem />
                            <TransferRowMenuItem />
                          </>
                        }
                      />
                    </td>
                  </tr>
                </RecordContextProvider>
              ))
            ) : (
              <tr>
                <td colSpan={visibleDayKeys.length + 8} className="px-3 py-8 text-center text-sm text-slate-400">
                  Sin nomina para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TarjaNominaList = ({
  embedded = false,
  rowClick: _rowClick = "edit",
  perPage = 10,
  createTo,
}: TarjaNominaListProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const ensuredKeys = useRef(new Set<string>());
  const [isEnsuring, setIsEnsuring] = useState(false);
  const callerUrl = `${location.pathname}${location.search}`;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let filter: Record<string, unknown> = {};
    try {
      filter = JSON.parse(params.get("filter") || "{}") as Record<string, unknown>;
    } catch {
      filter = {};
    }
    const tarjaId = Number(filter.tarja_id);
    const idproyecto = Number(params.get("idproyecto"));
    const contactoId = Number(params.get("contacto_id"));
    const fechainicio = params.get("fechainicio");
    const fechafinal = params.get("fechafinal");
    const payload = Number.isFinite(tarjaId) && tarjaId > 0
      ? { tarja_id: tarjaId }
      : Number.isFinite(idproyecto) && idproyecto > 0 && fechainicio && fechafinal
        ? {
            idproyecto,
            contacto_id:
              Number.isFinite(contactoId) && contactoId > 0 ? contactoId : null,
            fechainicio,
            fechafinal,
          }
        : null;
    if (!payload) return;

    const key = JSON.stringify(payload);
    if (ensuredKeys.current.has(key)) return;
    ensuredKeys.current.add(key);
    setIsEnsuring(!(Number.isFinite(tarjaId) && tarjaId > 0));

    dataProvider
      .create<{ id: number; tarja_id?: number }>("tarjas/asegurar-nomina", {
        data: payload,
      })
      .then(({ data }) => {
        const resolvedTarjaId = Number(data.tarja_id ?? data.id);
        if (!(Number.isFinite(tarjaId) && tarjaId > 0) && resolvedTarjaId > 0) {
          params.set("filter", JSON.stringify({ ...filter, tarja_id: resolvedTarjaId }));
          navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        } else {
          refresh();
        }
      })
      .catch(() => {
        notify("No se pudo generar la nomina de la quincena", { type: "warning" });
      })
      .finally(() => setIsEnsuring(false));
  }, [dataProvider, location.pathname, location.search, navigate, notify, refresh]);

  const createUrl = useMemo(() => {
    const target = createTo || "/tarja-nomina/create";
    const [pathname, query = ""] = target.split("?", 2);
    const createParams = new URLSearchParams(query);
    createParams.set("returnTo", callerUrl);
    return `${pathname}?${createParams.toString()}`;
  }, [callerUrl, createTo]);

  if (isEnsuring) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Generando nomina de la quincena...
      </div>
    );
  }

  return (
    <List<TarjaNominaRecord>
      resource="tarja-nomina"
      title={<TarjaNominaTitle embedded={embedded} />}
      filters={LIST_FILTERS}
      actions={<ListActions createTo={createUrl} />}
      debounce={300}
      perPage={perPage}
      pagination={<ListPaginator />}
      sort={{ field: "id", order: "ASC" }}
      containerClassName={cn(LIST_CONTAINER_XL, "max-w-[1120px]")}
      disableSyncWithLocation={embedded}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
    >
      <TarjaNominaGrid />
    </List>
  );
};

export default TarjaNominaList;

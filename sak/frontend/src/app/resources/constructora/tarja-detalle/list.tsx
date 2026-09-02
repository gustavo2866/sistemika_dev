"use client";

import { useRef, useState, type RefObject } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCreatePath, useDataProvider, useListContext } from "ra-core";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, MoreHorizontal, Pencil, TableProperties, UserRound } from "lucide-react";

import { List, LIST_CONTAINER_2XL } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { buildListFilters, ListPaginator } from "@/components/forms/form_order";
import { CompactSoloActivasToggleFilter } from "@/components/forms/form_order/list/solo_activas_toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TarjaDetalleCell = {
  detalle_id?: number | null;
  fecha?: string | null;
  horas?: number | null;
  idestado?: number | null;
  estado?: string | null;
  estado_nombre?: string | null;
  descripcion?: string | null;
};

type TarjaNovedadSummary = {
  id?: number | null;
  horas_justificadas?: number | null;
  presentismo?: boolean | null;
  adicional?: number | null;
  premio?: number | null;
  observaciones?: string | null;
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
  categoria_codigo?: string | null;
  actividad_codigo?: string | null;
  novedad?: TarjaNovedadSummary | null;
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
  { keyPrefix: "tarja-detalle" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const escapeHtml = (value?: string | number | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const getTarjaDetalleExportCellText = (
  row: TarjaDetalleRow,
  columnKey: DayKey | "empleado" | "categoria" | "actividad" | "horas" | "presentismo" | "bonos" | "comentario",
) => {
  if (dayKeys.includes(columnKey as DayKey)) {
    const cell = row[columnKey as DayKey];
    const horas = cell?.horas == null ? "" : formatHours(Number(cell.horas));
    const estado = shouldShowEstado(cell?.estado) ? String(cell?.estado ?? "") : "";
    return [horas, estado].filter(Boolean).join(" ");
  }

  const workedHours = getRowWorkedHours(row);
  const justifiedHours = getRowJustifiedHours(row);
  const totalHours = workedHours + justifiedHours;
  const totalBonus = Number(row.novedad?.adicional ?? 0) + Number(row.novedad?.premio ?? 0);

  switch (columnKey) {
    case "categoria":
      return row.categoria_codigo ?? "";
    case "actividad":
      return row.actividad_codigo ?? "";
    case "horas":
      return formatHours(totalHours);
    case "presentismo":
      return `${row.novedad?.presentismo ? "SI" : "NO"} trab:${formatHours(workedHours)}${justifiedHours ? ` just:${formatHours(justifiedHours)}` : ""}`;
    case "bonos":
      return formatAmount(totalBonus);
    case "comentario":
      return row.novedad?.observaciones ?? "";
    default:
      return [row.empleado, row.dni].filter(Boolean).join(" ");
  }
};

const downloadTarjaDetalleExcel = (
  filename: string,
  title: string,
  rows: TarjaDetalleRow[],
) => {
  const headers = [
    "Empleado",
    ...dayKeys.map((key) => `${formatDayName(rows[0]?.[key], key)} ${formatDayLabel(rows[0]?.[key], key)}`),
    "Categ",
    "Act",
    "Horas",
    "Pres",
    "Bonos",
    "Coment",
  ];
  const columnKeys = [
    "empleado",
    ...dayKeys,
    "categoria",
    "actividad",
    "horas",
    "presentismo",
    "bonos",
    "comentario",
  ] as const;
  const bodyRows = rows
    .map((row, rowIndex) => {
      const cells = columnKeys
        .map((columnKey) => {
          const isSunday = dayKeys.includes(columnKey as DayKey) && isNonWorkingDay(rows[0]?.[columnKey as DayKey]?.fecha);
          const style = [
            "border:1px solid #cbd5e1",
            "mso-number-format:\\@",
            "font-size:10px",
            "padding:3px",
            isSunday ? "background:#e5e7eb" : rowIndex % 2 ? "background:#fafafa" : "",
          ]
            .filter(Boolean)
            .join(";");
          return `<td style="${style}">${escapeHtml(getTarjaDetalleExportCellText(row, columnKey))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 12px 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th { border: 1px solid #cbd5e1; background: #000; color: #fff; font-size: 10px; padding: 4px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  downloadBlob(filename.replace(/\.(csv|xlsx?)$/i, ".xls"), blob);
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
  value.length > maxLength ? `${value.slice(0, Math.max(maxLength - 1, 0))}.` : value;

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
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
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
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return parts.join("");
};

const downloadTarjaDetallePdf = (
  filename: string,
  title: string,
  rows: TarjaDetalleRow[],
) => {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 18;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  const rowHeight = 18;
  const tableTop = pageHeight - 48;
  const normalRowsPerPage = Math.max(Math.floor((tableTop - margin - headerHeight) / rowHeight), 1);
  const columns = [
    { label: "Empleado", width: 112, align: "left", size: 5.8, max: 24, key: "empleado" },
    ...dayKeys.map((key) => ({
      label: `${formatDayName(rows[0]?.[key], key)} ${formatDayLabel(rows[0]?.[key], key)}`,
      width: 24,
      align: "center",
      size: 5.2,
      max: 7,
      dayKey: key,
    })),
    { label: "Categ", width: 28, align: "center", size: 5.2, max: 6, key: "categoria" },
    { label: "Act", width: 28, align: "center", size: 5.2, max: 6, key: "actividad" },
    { label: "Horas", width: 36, align: "center", size: 5.8, max: 8, key: "horas" },
    { label: "Pres", width: 42, align: "center", size: 5.2, max: 10, key: "presentismo" },
    { label: "Bonos", width: 62, align: "center", size: 5.2, max: 16, key: "bonos" },
    { label: "Coment", width: tableWidth - 112 - 24 * 15 - 28 - 28 - 36 - 42 - 62, align: "left", size: 5.2, max: 34, key: "comentario" },
  ] as const;

  const getCellText = (row: TarjaDetalleRow, column: (typeof columns)[number]) => {
    if ("dayKey" in column) {
      const cell = row[column.dayKey];
      const horas = cell?.horas == null ? "" : formatHours(Number(cell.horas));
      const estado = shouldShowEstado(cell?.estado) ? String(cell?.estado ?? "") : "";
      return [horas, estado].filter(Boolean).join(" ");
    }

    const workedHours = getRowWorkedHours(row);
    const justifiedHours = getRowJustifiedHours(row);
    const totalHours = workedHours + justifiedHours;
    const totalBonus = Number(row.novedad?.adicional ?? 0) + Number(row.novedad?.premio ?? 0);

    switch (column.key) {
      case "categoria":
        return row.categoria_codigo ?? "";
      case "actividad":
        return row.actividad_codigo ?? "";
      case "horas":
        return formatHours(totalHours);
      case "presentismo":
        return `${row.novedad?.presentismo ? "SI" : "NO"} trab:${formatHours(workedHours)}${justifiedHours ? ` just:${formatHours(justifiedHours)}` : ""}`;
      case "bonos":
        return formatAmount(totalBonus);
      case "comentario":
        return row.novedad?.observaciones ?? "";
      default:
        return [row.empleado, row.dni].filter(Boolean).join(" ");
    }
  };

  const text = (value: string, x: number, y: number, size: number, color = "0 g") =>
    `${color} BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${toPdfSafeText(value)}) Tj ET\n`;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `0.82 G ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  const fillRect = (x: number, y: number, width: number, height: number, rgb: string) =>
    `q ${rgb} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;

  const paginateRows = () => {
    const pages: TarjaDetalleRow[][] = [];
    for (let index = 0; index < rows.length; index += normalRowsPerPage) {
      pages.push(rows.slice(index, index + normalRowsPerPage));
    }
    return pages.length ? pages : [[]];
  };

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
    const tableBottom = tableTop - headerHeight - rowCount * rowHeight;
    const signatureY = tableBottom - 40;
    const lineWidth = 210;
    const encargadoX = margin + 90;
    const ingenieroX = margin + tableWidth - lineWidth - 90;
    content += line(encargadoX, signatureY, encargadoX + lineWidth, signatureY);
    content += line(ingenieroX, signatureY, ingenieroX + lineWidth, signatureY);
    content += text("Firma encargado", encargadoX + 70, signatureY - 12, 7);
    content += text("Firma ingeniero", ingenieroX + 72, signatureY - 12, 7);
    return content;
  };

  const pageRowsList = paginateRows();
  const pages = pageRowsList.map((pageRows, pageIndex) => {
    const isLastPage = pageIndex === pageRowsList.length - 1;
    const tableBottom = tableTop - headerHeight - pageRows.length * rowHeight;
    let content = "0.82 G 0.4 w\n";
    content += text(title, margin, pageHeight - 26, 11);
    content += text(`Pagina ${pageIndex + 1}`, pageWidth - margin - 42, pageHeight - 26, 6);

    pageRows.forEach((_row, rowIndex) => {
      if (rowIndex % 2 === 0) return;
      const rowTop = tableTop - headerHeight - rowIndex * rowHeight;
      content += fillRect(margin, rowTop - rowHeight, tableWidth, rowHeight, "0.98 0.98 0.98");
    });

    columns.forEach((column, columnIndex) => {
      if (!("dayKey" in column) || !isNonWorkingDay(rows[0]?.[column.dayKey]?.fecha)) return;
      content += fillRect(
        columnPositions[columnIndex],
        tableBottom,
        column.width,
        pageRows.length * rowHeight,
        "0.90 0.90 0.90",
      );
    });
    content += fillRect(margin, tableTop - headerHeight, tableWidth, headerHeight, "0 0 0");

    let x = margin;
    columns.forEach((column) => {
      content += text(truncatePdfText(column.label, column.max), x + 2, tableTop - 12, 5.2, "1 g");
      x += column.width;
    });

    pageRows.forEach((row, rowIndex) => {
      const rowBottom = tableTop - headerHeight - rowIndex * rowHeight - rowHeight;
      let cellX = margin;
      columns.forEach((column) => {
        const rawValue = getCellText(row, column);
        const value = truncatePdfText(rawValue, column.max);
        const approximateWidth = value.length * column.size * 0.48;
        const textX = column.align === "center" ? cellX + Math.max((column.width - approximateWidth) / 2, 1) : cellX + 2;
        content += text(value, textX, rowBottom + 6, column.size);
        cellX += column.width;
      });
    });
    content = addGridLines(content, pageRows.length);
    if (isLastPage && tableBottom - 52 >= margin) {
      content = addSignatureArea(content, pageRows.length);
    }
    return content;
  });

  if (rows.length) {
    const lastPageRowCount = pageRowsList[pageRowsList.length - 1]?.length ?? 0;
    const lastTableBottom = tableTop - headerHeight - lastPageRowCount * rowHeight;
    if (lastTableBottom - 52 < margin) {
      let signaturePage = "0.82 G 0.4 w\n";
      signaturePage += text(title, margin, pageHeight - 26, 11);
      signaturePage += text(`Pagina ${pages.length + 1}`, pageWidth - margin - 42, pageHeight - 26, 6);
      signaturePage = addSignatureArea(signaturePage, 0);
      pages.push(signaturePage);
    }
  }

  downloadBlob(filename, new Blob([buildPdfDocument(pages)], { type: "application/pdf" }));
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

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getWorkedHours = (cell?: TarjaDetalleCell) => {
  const horas = Number(cell?.horas ?? 0);
  return Number.isFinite(horas) ? horas : 0;
};

const getExpectedHours = (dateValue?: string | null) => {
  const date = String(dateValue ?? "").slice(0, 10);
  if (!date) return 0;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 0) return 0;
  if (day === 6) return 6;
  return 9;
};

const isIllnessCell = (cell?: TarjaDetalleCell) => {
  const values = [
    normalizeText(cell?.estado),
    normalizeText(cell?.estado_nombre),
    normalizeText(cell?.descripcion),
  ].filter(Boolean);
  return values.some(
    (value) =>
      value === "enf" ||
      value === "acc" ||
      value.includes("enfermedad") ||
      value.includes("enfermo") ||
      value.includes("accidente"),
  );
};

const getJustifiedHours = (cell?: TarjaDetalleCell) => {
  if (!isIllnessCell(cell)) return 0;
  return Math.max(getExpectedHours(cell?.fecha) - getWorkedHours(cell), 0);
};

const getRowWorkedHours = (row: TarjaDetalleRow) =>
  dayKeys.reduce((total, key) => total + getWorkedHours(row[key]), 0);

const getRowJustifiedHours = (row: TarjaDetalleRow) =>
  dayKeys.reduce((total, key) => total + getJustifiedHours(row[key]), 0);

const formatHours = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 1 });

const formatAmount = (value?: number | null) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("es-AR", { maximumFractionDigits: 0 });
};

const hasAmount = (value?: number | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount !== 0;
};

const TarjaDetalleHorasCell = ({ cell }: { cell?: TarjaDetalleCell }) => {
  const horas = cell?.horas;
  return (
    <span className="block min-h-4 text-center text-[9px] font-medium leading-4 text-slate-700">
      {horas == null ? "" : formatHours(Number(horas))}
    </span>
  );
};

const shouldShowEstado = (estado?: string | null) => {
  const normalized = String(estado ?? "").trim().toUpperCase();
  return Boolean(normalized && normalized !== "P");
};

const TarjaDetalleRowActions = ({ row }: { row: TarjaDetalleRow }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const createPath = useCreatePath();

  const navigateToNovedadEdit = () => {
    const returnTo = `${location.pathname}${location.search}`;
    const existingId = row.novedad?.id;
    if (existingId != null) {
      const params = new URLSearchParams({ returnTo });
      navigate(`${createPath({ resource: "tarja-novedades", type: "edit", id: existingId })}?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({
      tarja_id: String(row.tarja_id),
      nomina_id: String(row.idnomina),
      returnTo,
    });
    navigate(`${createPath({ resource: "tarja-novedades", type: "create" })}?${params.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Acciones"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onSelect={navigateToNovedadEdit}>
          <Pencil className="mr-2 size-3.5" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            navigate(createPath({ resource: "nominas", type: "edit", id: row.idnomina }))
          }
        >
          <UserRound className="mr-2 size-3.5" />
          Empleado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  tarjaId,
}: {
  tarjaId?: string;
}) => {
  const dataProvider = useDataProvider();
  const { data = [], filterValues, sort, total } = useListContext<TarjaDetalleRow>();
  const [isExporting, setIsExporting] = useState(false);
  const rows = data as TarjaDetalleRow[];
  const obra = rows[0]?.obra ?? "";

  const getExportData = () => {
    const title = ["Tarja Detalle", tarjaId ? `#${tarjaId}` : "", obra]
      .filter(Boolean)
      .join(" - ");
    const filename = buildSafeFilename(title || "tarja-detalle");
    return { title, filename };
  };

  const loadExportRows = async () => {
    const response = await dataProvider.getList<TarjaDetalleRow>("tarja-detalle", {
        filter: {
          ...(filterValues ?? {}),
          tarja_id: tarjaId ? Number(tarjaId) : undefined,
        },
        pagination: {
          page: 1,
          perPage: typeof total === "number" && total > 0 ? total : 1000,
        },
        sort: {
          field: sort?.field ?? "empleado",
          order: sort?.order ?? "ASC",
        },
      });
    return response.data as TarjaDetalleRow[];
  };

  const handleExcelExport = async () => {
    const { title, filename } = getExportData();
    setIsExporting(true);
    try {
      const exportRows = await loadExportRows();
      downloadTarjaDetalleExcel(`${filename}.xls`, title, exportRows);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfExport = async () => {
    const { title, filename } = getExportData();
    setIsExporting(true);
    try {
      const exportRows = await loadExportRows();
      downloadTarjaDetallePdf(`${filename}.pdf`, title, exportRows);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <FilterButton
        filters={LIST_FILTERS}
        size="sm"
        buttonClassName={ACTION_BUTTON_CLASS}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ACTION_BUTTON_CLASS}
            disabled={!rows.length || isExporting}
            title="Exportar"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuItem onSelect={handleExcelExport}>
            <FileSpreadsheet className="mr-2 size-3.5" />
            Excel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handlePdfExport}>
            <FileText className="mr-2 size-3.5" />
            PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
              <th className="sticky left-0 z-10 w-[112px] border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-left font-semibold">
                Empleado
              </th>
              {dayKeys.map((key) => {
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
                      {formatDayName(cell, key)}
                    </span>
                    <span className="block text-[5.5px] font-normal leading-tight text-slate-400">
                      {formatDayLabel(cell, key)}
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
              rows.map((row) => {
                const workedHours = getRowWorkedHours(row);
                const justifiedHours = getRowJustifiedHours(row);
                const totalHours = workedHours + justifiedHours;
                const totalBonus =
                  Number(row.novedad?.adicional ?? 0) +
                  Number(row.novedad?.premio ?? 0);

                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="sticky left-0 z-10 max-w-[112px] border-r border-slate-200 bg-white px-1 py-1.5">
                    <span className="block truncate font-medium text-slate-800">{row.empleado}</span>
                    <span className="block truncate text-[8px] text-slate-400">{row.dni}</span>
                  </td>
                  {dayKeys.map((key) => {
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
                  <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 text-center align-top text-[7px] font-semibold leading-4 text-slate-600">
                    {row.categoria_codigo ?? ""}
                  </td>
                  <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 text-center align-top text-[7px] font-semibold leading-4 text-slate-600">
                    {row.actividad_codigo ?? ""}
                  </td>
                  <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top text-center tabular-nums text-slate-800">
                    <span className="block text-[9px] font-medium leading-4">{formatHours(totalHours)}</span>
                  </td>
                  <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top text-center font-semibold leading-tight text-slate-800">
                    <span className="block text-[8px]">{row.novedad?.presentismo ? "SI" : "NO"}</span>
                    <span className="block text-[6.5px] tabular-nums text-slate-500">
                      trab: {formatHours(workedHours)}
                    </span>
                    {justifiedHours ? (
                      <span className="block text-[6.5px] tabular-nums text-amber-700">
                        just: {formatHours(justifiedHours)}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-r border-slate-200 bg-slate-50 px-0.5 py-1 align-top text-center tabular-nums text-slate-800">
                    <span className="block text-[9px] font-semibold leading-4">
                      {formatAmount(totalBonus)}
                    </span>
                    {hasAmount(row.novedad?.adicional) ? (
                      <span className="block text-[6.5px] font-medium leading-[8px] text-slate-500">
                        Adicional: {formatAmount(row.novedad?.adicional)}
                      </span>
                    ) : null}
                    {hasAmount(row.novedad?.premio) ? (
                      <span className="block text-[6.5px] font-medium leading-[8px] text-slate-500">
                        Premio: {formatAmount(row.novedad?.premio)}
                      </span>
                    ) : null}
                  </td>
                  <td className="w-[86px] max-w-[86px] bg-slate-50 px-1 py-1 align-top text-[6px] leading-[7px] text-slate-600">
                    <span className="block max-h-[28px] overflow-hidden break-words">
                      {row.novedad?.observaciones ?? ""}
                    </span>
                  </td>
                  <td className="bg-slate-50 px-0.5 py-1 text-center align-middle">
                    <TarjaDetalleRowActions row={row} />
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={23} className="px-3 py-8 text-center text-sm text-slate-400">
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
      actions={<TarjaDetalleActions tarjaId={id} />}
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

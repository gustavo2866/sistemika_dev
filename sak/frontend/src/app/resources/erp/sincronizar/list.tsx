"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetList, useNotify } from "ra-core";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Database,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import type { ErpEmpresa } from "@/app/resources/cashflow/empresas/model";
import type { ErpCashPeriodo } from "@/app/resources/cashflow/periodos/model";
import { fetchCashProjectionHorizon } from "@/app/resources/cashflow/proyectado/horizon";
import { Confirm } from "@/components/confirm";
import { ResourceTitle } from "@/components/resource-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

import {
  INITIAL_PROCESS_STEPS,
  createPendingFileRow,
  type PendingFileRow,
  type ProcessStatus,
  type ProcessStepId,
} from "./model";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const periodLabel = (period: string) => period ? new Intl.DateTimeFormat("es-AR", {
  month: "long", year: "numeric",
}).format(new Date(`${period.slice(0, 7)}-01T12:00:00`)) : "el período";

const shiftPeriod = (period: string, offset: number) => {
  const [year, month] = period.slice(0, 7).split("-").map(Number);
  const absolute = year * 12 + month - 1 + offset;
  return `${Math.floor(absolute / 12)}-${String(absolute % 12 + 1).padStart(2, "0")}`;
};

const authHeaders = (json = false) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const errorMessage = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (typeof detail?.error?.message === "string") return detail.error.message;
  if (typeof body?.message === "string") return body.message;
  return fallback;
};

const postJson = async <T,>(path: string, body: unknown, fallback: string): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
};

const postFile = async <T,>(path: string, row: PendingFileRow, mode?: "replace"): Promise<T> => {
  if (!row.file || !row.empresaId) throw new Error("Falta seleccionar empresa o archivo");
  const data = new FormData();
  data.append("erp_empresa_id", row.empresaId);
  if (mode) data.append("mode", mode);
  data.append("file", row.file);
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: data,
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, `No se pudo procesar ${row.file.name}`));
  }
  return response.json() as Promise<T>;
};

const StatusIcon = ({ status }: { status: ProcessStatus }) => {
  if (status === "processing") return <LoaderCircle className="size-4 animate-spin text-blue-600" />;
  if (status === "completed") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "error") return <AlertCircle className="size-4 text-destructive" />;
  return <Circle className="size-4 text-muted-foreground/50" />;
};

const statusLabel: Record<ProcessStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Procesado",
  error: "Error",
};

export const ErpSincronizarPage = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [closePeriod, setClosePeriod] = useState(false);
  const [files, setFiles] = useState<PendingFileRow[]>([]);
  const [steps, setSteps] = useState(() => INITIAL_PROCESS_STEPS.map((step) => ({ ...step })));
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [syncRange, setSyncRange] = useState<{ periodo_desde: string; periodo_hasta: string; proyeccion_hasta: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const companiesInitialized = useRef(false);

  const { data: companies = [], isPending: companiesPending } = useGetList<ErpEmpresa>(
    "erp/empresas",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "empresa_nombre", order: "ASC" },
      filter: { grupo: "wcl" },
    },
  );
  const { data: closingPeriods = [], isPending: closingPeriodsPending, error: closingPeriodsError } = useGetList<ErpCashPeriodo>(
    "erp/cash/periodos",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "fecha_periodo", order: "ASC" },
      filter: { estado: "EN_CIERRE" },
    },
  );
  const { data: openPeriods = [], isPending: openPeriodsPending, error: openPeriodsError } = useGetList<ErpCashPeriodo>(
    "erp/cash/periodos",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "fecha_periodo", order: "ASC" },
      filter: { estado: "ABIERTO" },
    },
  );

  const periodsPending = closingPeriodsPending || openPeriodsPending;
  const periodsError = closingPeriodsError || openPeriodsError;
  const selectedPeriod = closingPeriods[0] ?? openPeriods[0];
  const periodo = !periodsPending && !periodsError
    ? selectedPeriod?.fecha_periodo?.slice(0, 7) ?? ""
    : "";

  useEffect(() => {
    setClosePeriod(false);
    setSyncRange(null);
  }, [periodo]);

  useEffect(() => {
    if (companiesInitialized.current || companiesPending) return;
    setFiles(
      companies.length > 0
        ? companies.map((company) => ({
            ...createPendingFileRow(),
            empresaId: String(company.id),
          }))
        : [createPendingFileRow()],
    );
    companiesInitialized.current = true;
  }, [companies, companiesPending]);

  const selectedCompanyIds = useMemo(
    () => new Set(files.map((row) => row.empresaId).filter(Boolean)),
    [files],
  );

  const updateStep = (id: ProcessStepId, status: ProcessStatus, detail?: string) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, status, detail } : step)));
  };

  const updateFile = (id: string, changes: Partial<PendingFileRow>) => {
    setFiles((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  };

  const validateConfiguration = () => {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error("No existe un período en cierre o abierto para sincronizar");
    }
    if (files.length === 0) throw new Error("Debe agregar al menos un archivo de pendientes");
    const companyIds = files.map((row) => row.empresaId);
    if (companyIds.some((id) => !id) || files.some((row) => !row.file)) {
      throw new Error("Cada fila debe tener una empresa y un archivo CSV");
    }
    if (new Set(companyIds).size !== companyIds.length) {
      throw new Error("No se puede seleccionar dos veces la misma empresa");
    }
    for (const row of files) {
      if (!row.file?.name.toLowerCase().endsWith(".csv")) throw new Error("Todos los archivos deben ser CSV");
      if (row.file.size > MAX_FILE_SIZE) throw new Error(`${row.file.name} supera el máximo de 5 MB`);
    }
    return periodo;
  };

  const handleRunRequest = async () => {
    setPreparing(true);
    try {
      const start = validateConfiguration();
      const response = await fetch(`${apiUrl}/erp/libro-diario/periodos-disponibles?periodo_desde=${start}`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await errorMessage(response, "No se pudieron consultar los períodos del ERP"));
      const [range, horizon] = await Promise.all([response.json(), fetchCashProjectionHorizon()]);
      setSyncRange({ ...range, proyeccion_hasta: closePeriod ? shiftPeriod(start, 24) : horizon.proyeccion_hasta.slice(0, 7) });
      setConfirmOpen(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "La configuración no es válida", { type: "warning" });
    } finally {
      setPreparing(false);
    }
  };

  const handleRun = async () => {
    setConfirmOpen(false);
    let syncPeriod: string;
    try {
      syncPeriod = validateConfiguration();
      if (!syncRange || syncRange.periodo_desde !== syncPeriod) throw new Error("Volvé a iniciar para actualizar el rango de sincronización");
    } catch (error) {
      notify(error instanceof Error ? error.message : "La configuración no es válida", { type: "warning" });
      return;
    }

    const syncEndPeriod = syncRange!.periodo_hasta;
    const rangeLabel = `${syncPeriod} a ${syncEndPeriod}`;
    setRunning(true);
    setLastError(null);
    setSteps(INITIAL_PROCESS_STEPS.map((step) => ({ ...step })));
    setFiles((current) => current.map((row) => ({ ...row, status: "pending", detail: undefined })));
    let activeStep: ProcessStepId = "validate";

    try {
      updateStep("validate", "processing", "Comprobando archivos antes de modificar datos");
      for (const row of files) {
        updateFile(row.id, { status: "processing", detail: "Validando CSV" });
        const result = await postFile<{ rows_read: number; rows_invalid: number }>(
          "/erp/cash/pendientes-input/validate",
          row,
        );
        updateFile(row.id, {
          status: "completed",
          detail: `${result.rows_read} filas${result.rows_invalid ? `, ${result.rows_invalid} inválidas` : ""}`,
        });
      }
      updateStep("validate", "completed", `${files.length} archivo(s) válido(s)`);

      activeStep = "periodo";
      updateStep(activeStep, "processing", `Preparando ${periodLabel(syncPeriod)}`);
      await postJson("/erp/cash/sync/start", { periodo: syncPeriod }, "No se pudo iniciar el cierre del período");
      updateStep(activeStep, "completed", `${periodLabel(syncPeriod)} en cierre`);

      activeStep = "libro-diario";
      updateStep(activeStep, "processing", `Períodos ${rangeLabel}`);
      await postJson(
        "/erp/libro-diario/sync-range",
        { periodo_desde: syncPeriod, periodo_hasta: syncEndPeriod, actualizar_presupuestos: false },
        "No se pudo sincronizar Libro Diario",
      );
      updateStep(activeStep, "completed", `Períodos ${rangeLabel} sincronizados`);

      activeStep = "libro-mayor";
      updateStep(activeStep, "processing", `Períodos ${rangeLabel}`);
      const mayorResult = await postJson<{ rows_inserted?: number }>(
        "/erp/libro-mayor/sync-range",
        { periodo_desde: syncPeriod, periodo_hasta: syncEndPeriod },
        "No se pudo sincronizar Libro Mayor",
      );
      const mayorRows = Number(mayorResult.rows_inserted ?? 0);
      updateStep(activeStep, "completed", `${mayorRows.toLocaleString("es-AR")} registros cargados`);

      activeStep = "actualizar-icc";
      updateStep(activeStep, "processing", "Aplicando ICC a los totales del Libro Mayor");
      const iccResult = await postJson<{
        rows_updated?: number;
        periodo_destino?: string;
        periodo_destino_fallback?: boolean;
      }>(
        "/erp/libro-mayor/update-icc",
        {},
        "No se pudo actualizar Libro Mayor por ICC",
      );
      updateStep(
        activeStep,
        "completed",
        `${Number(iccResult.rows_updated ?? 0).toLocaleString("es-AR")} registros a ICC ${iccResult.periodo_destino ?? "-"}${iccResult.periodo_destino_fallback ? " (último disponible)" : ""}`,
      );

      activeStep = "presupuesto";
      updateStep(activeStep, "processing", `Períodos ${rangeLabel}`);
      const budget = await postJson<{ totales?: { presupuestos_updated?: number; presupuestos_created?: number } }>(
        "/erp/presupuestos/sync-reales-range",
        { periodo_desde: syncPeriod, periodo_hasta: syncEndPeriod },
        "No se pudo actualizar Presupuesto",
      );
      const budgetRows = Number(budget.totales?.presupuestos_updated ?? 0) + Number(budget.totales?.presupuestos_created ?? 0);
      updateStep(activeStep, "completed", `${budgetRows.toLocaleString("es-AR")} presupuestos actualizados`);

      activeStep = "pendientes";
      updateStep(activeStep, "processing", `0 de ${files.length} archivos`);
      let importedRows = 0;
      for (let index = 0; index < files.length; index += 1) {
        const row = files[index];
        updateFile(row.id, { status: "processing", detail: "Importando" });
        try {
          const result = await postFile<{ rows_imported: number; rows_read: number; duplicate?: boolean }>(
            "/erp/cash/pendientes-input/import",
            row,
            "replace",
          );
          importedRows += Number(result.rows_imported ?? 0);
          updateFile(row.id, {
            status: "completed",
            detail: result.duplicate ? `${result.rows_read} filas, archivo ya cargado` : `${result.rows_imported} filas importadas`,
          });
        } catch (error) {
          updateFile(row.id, { status: "error", detail: error instanceof Error ? error.message : "Error de importación" });
          throw error;
        }
        updateStep(activeStep, "processing", `${index + 1} de ${files.length} archivos`);
      }
      updateStep(activeStep, "completed", `${importedRows.toLocaleString("es-AR")} filas importadas`);

      activeStep = "cash";
      const cashEndPeriod = syncRange!.proyeccion_hasta;
      updateStep(activeStep, "processing", `Desde ${syncPeriod} hasta ${cashEndPeriod}`);
      await postJson(
        "/erp/cash/rebuild",
        { periodo_desde: syncPeriod, periodo_reales_hasta: syncEndPeriod, cerrar_periodo: closePeriod },
        "No se pudo reconstruir Cash",
      );
      updateStep(activeStep, "completed", closePeriod
        ? `${periodLabel(syncPeriod)} cerrado. Proyección desde ${shiftPeriod(syncPeriod, 1)} hasta ${cashEndPeriod} (24 meses)`
        : `Cash actualizado desde ${syncPeriod} hasta ${cashEndPeriod}. El período continúa en cierre`);

      updateStep("complete", "completed", "Sincronización terminada correctamente");
      notify("Sincronización ERP finalizada. Cash actualizado.", { type: "success" });
      setClosePeriod(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Error inesperado durante la sincronización";
      const message = activeStep === "cash"
        ? `Los datos ERP quedaron importados, pero Cash no se actualizó. ${detail}`
        : detail;
      updateStep(activeStep, "error", message);
      setLastError(message);
      notify(message, { type: "error" });
    } finally {
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: ["erp/cash/periodos"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-projection-horizon"] });
      void queryClient.invalidateQueries({ queryKey: ["erp-cash-panel"] });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <ResourceTitle icon={Database} text="Sincronizar ERP" className="text-lg sm:text-xl" />
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Importa libros y pendientes, actualiza ICC y presupuesto, y actualiza Cash al finalizar.
          </p>
        </div>
        <Button onClick={handleRunRequest} disabled={running || preparing || companiesPending || periodsPending || !!periodsError || !periodo}>
          <RefreshCw className={cn("size-4", (running || preparing) && "animate-spin")} />
          {running ? "Sincronizando" : preparing ? "Consultando períodos" : "Iniciar sincronización"}
        </Button>
      </div>

      {lastError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>El proceso se detuvo</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-4 py-4">
            <CardHeader className="px-4 sm:px-5">
              <CardTitle className="text-base">Período a sincronizar</CardTitle>
              <CardDescription>
                Se inicia en el primer período en cierre o, si no hay ninguno, en el primer abierto. Se cargan los meses hasta el último con movimientos en el ERP.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-4 sm:px-5">
              <label className="grid gap-1.5 text-xs font-medium">
                {selectedPeriod?.estado === "EN_CIERRE" ? "Desde el período en cierre" : "Desde el primer período abierto"}
                <Input type="month" value={periodo} disabled className="sm:max-w-xs" />
              </label>
              {syncRange?.periodo_desde === periodo ? (
                <label className="grid gap-1.5 text-xs font-medium">
                  Hasta el último período con movimientos
                  <Input type="month" value={syncRange.periodo_hasta} disabled />
                </label>
              ) : null}
              {periodo ? (
                <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                  <label className="flex items-start gap-2 text-sm font-medium" htmlFor="close-sync-period">
                    <Checkbox id="close-sync-period" className="mt-0.5" checked={closePeriod}
                      disabled={running || preparing || confirmOpen}
                      onCheckedChange={(checked) => { setClosePeriod(checked === true); setSyncRange(null); }} />
                    Cerrar {periodLabel(periodo)} al finalizar
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {closePeriod
                      ? `Si todo finaliza correctamente, solo se cerrará ${periodLabel(periodo)}. La proyección abarcará ${periodLabel(shiftPeriod(periodo, 1))} a ${periodLabel(shiftPeriod(periodo, 24))} (24 meses). Los meses posteriores seguirán abiertos.`
                      : "Al iniciar, este período quedará en cierre. Podés sincronizarlo varias veces y cerrarlo cuando esté completo. Los meses posteriores seguirán abiertos."}
                  </p>
                </div>
              ) : null}
              {periodsError ? (
                <p role="alert" className="text-xs text-destructive">No se pudieron cargar los períodos para sincronizar.</p>
              ) : !periodsPending && !periodo ? (
                <p role="status" className="text-xs text-muted-foreground">No hay períodos en cierre ni abiertos.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-4 py-4">
            <CardHeader className="px-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Archivos de pendientes</CardTitle>
                  <CardDescription className="mt-1">Un CSV por empresa. La carga reemplaza los pendientes actuales de esa empresa.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={running || files.length >= companies.length}
                  onClick={() => setFiles((current) => [...current, createPendingFileRow()])}
                >
                  <Plus className="size-3.5" /> Agregar archivo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">Empresa</TableHead>
                    <TableHead>Archivo CSV</TableHead>
                    <TableHead className="w-[150px]">Estado</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Select
                          value={row.empresaId}
                          disabled={running || companiesPending}
                          onValueChange={(value) => updateFile(row.id, { empresaId: value, status: "pending", detail: undefined })}
                        >
                          <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem
                                key={company.id}
                                value={String(company.id)}
                                disabled={row.empresaId !== String(company.id) && selectedCompanyIds.has(String(company.id))}
                              >
                                {company.empresa_nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="grid min-w-[260px] gap-1">
                          <Input
                            type="file"
                            accept=".csv,text/csv"
                            disabled={running}
                            className="cursor-pointer text-xs file:mr-2 file:text-xs"
                            onChange={(event) => updateFile(row.id, { file: event.target.files?.[0] ?? null, status: "pending", detail: undefined })}
                          />
                          {row.file ? <span className="text-[11px] text-muted-foreground">{(row.file.size / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 })} KB</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[135px] items-start gap-2">
                          <StatusIcon status={row.status} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium">{statusLabel[row.status]}</div>
                            {row.detail ? <div className="whitespace-normal text-[11px] text-muted-foreground">{row.detail}</div> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Quitar archivo"
                          disabled={running || files.length === 1}
                          onClick={() => setFiles((current) => current.filter((item) => item.id !== row.id))}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit gap-4 py-4 xl:sticky xl:top-4">
          <CardHeader className="px-4 sm:px-5">
            <CardTitle className="text-base">Estado del proceso</CardTitle>
            <CardDescription>Las etapas se ejecutan en este orden.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-5">
            <ol className="space-y-1">
              {steps.map((step, index) => (
                <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {index < steps.length - 1 ? <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-border" /> : null}
                  <span className="relative z-10 mt-0.5 bg-card"><StatusIcon status={step.status} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{step.label}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{statusLabel[step.status]}</Badge>
                    </div>
                    {step.detail ? <p className={cn("mt-0.5 text-[11px] text-muted-foreground", step.status === "error" && "text-destructive")}>{step.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Confirm
        isOpen={confirmOpen}
        title="Confirmar sincronización ERP"
        content={`Se reemplazarán los libros y los valores reales desde ${periodo} hasta ${syncRange?.periodo_hasta ?? periodo}, y los pendientes de ${files.length} empresa(s). La actualización ICC continuará aplicándose a todos los períodos desde 2024-01. Al finalizar, se actualizará Cash hasta ${syncRange?.proyeccion_hasta ?? "el fin del horizonte móvil de 24 meses"}, conservando el histórico y los importes manuales y comprometidos. ${closePeriod ? `Solo se cerrará ${periodLabel(periodo)}, y se completará la nueva ventana de 24 meses. Si falla el proceso, el período seguirá en cierre.` : `${periodLabel(periodo)} quedará en cierre, sin cerrarse. Los meses posteriores seguirán abiertos.`}`}
        confirm="Sincronizar"
        cancel="Cancelar"
        confirmColor="warning"
        ConfirmIcon={RefreshCw}
        loading={running}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRun}
      />
    </div>
  );
};


"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CalculatedVacancia } from "./model";
import { VACANCIA_STATE_STEPS } from "../propiedades/model";
import { formatEstadoPropiedad } from "../propiedades/model";

type VacanciaShowProps = {
  vacancia: CalculatedVacancia;
  onClose: () => void;
};

type CollapsibleSectionProps = {
  title: string | React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

const CollapsibleSection = ({ title, defaultExpanded = false, children }: CollapsibleSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {typeof title === 'string' ? (
              <CardTitle className="text-lg">{title}</CardTitle>
            ) : (
              title
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      {isExpanded && <CardContent>{children}</CardContent>}
    </Card>
  );
};

const DataRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex justify-between py-2 border-b last:border-b-0">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm">{value ?? "N/A"}</span>
  </div>
);

export default function VacanciaShow({ vacancia, onClose }: VacanciaShowProps) {
  const propiedad = vacancia.vacancia.propiedad;
  const vacanciaData = vacancia.vacancia;

  // Calcular días y costo por cada estado
  const calcularDiasEstado = (fechaInicio: string | null, fechaFin: string | null): number => {
    if (!fechaInicio) return 0;
    const inicio = new Date(fechaInicio);
    const fin = fechaFin ? new Date(fechaFin) : new Date();
    const diff = fin.getTime() - inicio.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calcularCostoEstado = (dias: number): number => {
    const valorAlquiler = propiedad?.valor_alquiler ?? 0;
    const expensas = propiedad?.expensas ?? 0;
    const costoMensual = valorAlquiler + expensas;
    return (costoMensual / 30) * dias;
  };

  const getEstadoInfo = (step: typeof VACANCIA_STATE_STEPS[number]) => {
    const fechaKey = step.dateField as keyof typeof vacanciaData;
    const comentarioKey = step.commentField as keyof typeof vacanciaData;
    const fecha = vacanciaData[fechaKey] as string | null;
    const comentario = vacanciaData[comentarioKey] as string | null;

    let dias = 0;
    if (fecha) {
      const stepIndex = VACANCIA_STATE_STEPS.findIndex(s => s.key === step.key);
      const nextStep = VACANCIA_STATE_STEPS[stepIndex + 1];
      const fechaFin = nextStep ? (vacanciaData[nextStep.dateField as keyof typeof vacanciaData] as string | null) : null;
      dias = calcularDiasEstado(fecha, fechaFin);
    }

    const costo = calcularCostoEstado(dias);

    return { fecha, comentario, dias, costo };
  };

  // Obtener historial de vacancias anteriores
  const historialVacancias = propiedad?.vacancias?.filter(v => v.id !== vacanciaData.id) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background shadow-lg overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h2 className="text-2xl font-bold">
                {propiedad?.nombre ?? `Propiedad ${vacanciaData.propiedad_id}`}
              </h2>
              <p className="text-sm text-muted-foreground">Ciclo de Vacancia #{vacanciaData.id}</p>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>

          {/* Datos de la Propiedad */}
          <CollapsibleSection 
            title={
              <div>
                <div className="text-lg font-semibold">Datos de la Propiedad</div>
                <div className="text-sm font-normal text-muted-foreground">
                  {propiedad?.nombre ?? "Sin nombre"} - {propiedad?.propietario ?? "Sin propietario"} - {formatEstadoPropiedad(propiedad?.estado)}
                </div>
              </div>
            } 
            defaultExpanded={false}
          >
            <div className="space-y-1">
              <DataRow label="Nombre" value={propiedad?.nombre} />
              <DataRow label="Tipo" value={propiedad?.tipo} />
              <DataRow label="Propietario" value={propiedad?.propietario} />
              <DataRow label="Estado" value={formatEstadoPropiedad(propiedad?.estado)} />
              <DataRow label="Ambientes" value={propiedad?.ambientes} />
              <DataRow label="Metros cuadrados" value={propiedad?.metros_cuadrados} />
              <DataRow label="Valor alquiler" value={propiedad?.valor_alquiler ? `$${propiedad.valor_alquiler}` : null} />
              <DataRow label="Expensas" value={propiedad?.expensas ? `$${propiedad.expensas}` : null} />
            </div>
          </CollapsibleSection>

          {/* Datos del Contrato */}
          <CollapsibleSection title="Datos del Contrato" defaultExpanded={false}>
            <div className="space-y-1">
              <DataRow 
                label="Fecha de ingreso" 
                value={propiedad?.fecha_ingreso ? new Date(propiedad.fecha_ingreso).toLocaleDateString('es-AR') : null} 
              />
              <DataRow 
                label="Vencimiento contrato" 
                value={propiedad?.vencimiento_contrato ? new Date(propiedad.vencimiento_contrato).toLocaleDateString('es-AR') : null} 
              />
              <DataRow label="Estado" value={formatEstadoPropiedad(propiedad?.estado)} />
              <DataRow 
                label="Fecha de estado" 
                value={propiedad?.estado_fecha ? new Date(propiedad.estado_fecha).toLocaleDateString('es-AR') : null} 
              />
              {propiedad?.estado_comentario && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Comentario</p>
                  <p className="text-sm bg-muted p-2 rounded">{propiedad.estado_comentario}</p>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Vacancia */}
          <CollapsibleSection title="Vacancia" defaultExpanded={true}>
            <div className="space-y-3">
              {VACANCIA_STATE_STEPS.map((step) => {
                const info = getEstadoInfo(step);

                return (
                  <div key={step.key} className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{step.label}</span>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {info.fecha ? new Date(info.fecha).toLocaleDateString('es-AR') : 'Sin fecha'}
                        </div>
                        {info.fecha && (
                          <div className="text-xs text-muted-foreground">
                            (días: {info.dias}, costo: ${info.costo.toFixed(0)})
                          </div>
                        )}
                      </div>
                    </div>
                    {info.comentario && (
                      <p className="text-sm text-muted-foreground">{info.comentario}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Histórico */}
          <CollapsibleSection title="Histórico" defaultExpanded={false}>
            {historialVacancias.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Ciclo</th>
                      <th className="text-left py-2 px-2 font-medium">Estado</th>
                      <th className="text-left py-2 px-2 font-medium">Fecha</th>
                      <th className="text-left py-2 px-2 font-medium">Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialVacancias.flatMap((v) =>
                      VACANCIA_STATE_STEPS.map((step) => {
                        const fechaKey = step.dateField as keyof typeof v;
                        const comentarioKey = step.commentField as keyof typeof v;
                        const fecha = v[fechaKey] as string | null;
                        const comentario = v[comentarioKey] as string | null;

                        return (
                          <tr key={`${v.id}-${step.key}`} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2">#{v.id}</td>
                            <td className="py-2 px-2">{step.label}</td>
                            <td className="py-2 px-2">
                              {fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-'}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">{comentario || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay vacancias anteriores para esta propiedad.</p>
            )}
          </CollapsibleSection>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

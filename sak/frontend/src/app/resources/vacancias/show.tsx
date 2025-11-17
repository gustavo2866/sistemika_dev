"use client";

import { useState } from "react";
import { Show } from "@/components/show";
import { useDataProvider, useNotify, useRecordContext, useRefresh } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { VACANCIA_STATE_STEPS, type Vacancia } from "../propiedades/model";
import { preferCalculated } from "@/lib/vacancias/metrics";

export const VacanciaShow = () => (
  <Show>
    <VacanciaDetails />
  </Show>
);

const VacanciaDetails = () => {
  const record = useRecordContext<Vacancia>();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  if (!record) return null;

  const diasReparacion = preferCalculated(record.dias_reparacion, record.dias_reparacion_calculado);
  const diasDisponibles = preferCalculated(record.dias_disponible, record.dias_disponible_calculado);
  const diasTotales = preferCalculated(record.dias_totales, record.dias_totales_calculado);

  const handleSubmit = async () => {
    try {
      await dataProvider.update("vacancias", {
        id: record.id,
        data: formState,
        previousData: record,
      });
      notify("Comentarios actualizados", { type: "success" });
      setOpen(false);
      setFormState({});
      refresh();
    } catch {
      notify("No se pudieron guardar los comentarios", { type: "error" });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Vacancia #{record.id} - Propiedad #{record.propiedad_id}
          </h1>
          <p className="text-muted-foreground">
            {record.propiedad?.nombre} - {record.propiedad?.tipo}
          </p>
        </div>
        <Badge variant={record.ciclo_activo ? "default" : "outline"}>
          {record.ciclo_activo ? "Ciclo activo" : "Ciclo cerrado"}
        </Badge>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Dias totales" value={diasTotales ?? "-"} />
        <MetricCard label="Dias en reparacion" value={diasReparacion ?? "-"} />
        <MetricCard label="Dias disponible" value={diasDisponibles ?? "-"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Comentarios por estado</CardTitle>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm">
                Editar comentarios
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[90vh]">
              <DrawerHeader>
                <DrawerTitle>Comentarios de la vacancia</DrawerTitle>
                <DrawerDescription>Actualice solo el texto de cada estado.</DrawerDescription>
              </DrawerHeader>
              <div className="grid gap-4 px-6 py-2">
                {VACANCIA_STATE_STEPS.map((step) => {
                  const field = step.commentField as keyof Vacancia;
                  return (
                    <div className="space-y-2" key={step.key}>
                      <Label>{step.label}</Label>
                      <Textarea
                        rows={3}
                        placeholder="Agregar comentario"
                        defaultValue={record[field] as string}
                        onChange={(event) => handleInputChange(field, event.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <DrawerFooter>
                <Button onClick={handleSubmit}>Guardar</Button>
                <DrawerClose asChild>
                  <Button variant="ghost">Cancelar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </CardHeader>
        <CardContent className="divide-y">
          {VACANCIA_STATE_STEPS.map((step) => {
            const comment = record[step.commentField as keyof Vacancia] as string | null | undefined;
            const date = record[step.dateField as keyof Vacancia];
            return (
              <div key={step.key} className="py-4">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{date ? new Date(String(date)).toLocaleString() : "-"}</p>
                <p className="mt-2 text-sm">{comment ?? "Sin comentario"}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <span className="text-2xl font-semibold">{value}</span>
    </CardContent>
  </Card>
);

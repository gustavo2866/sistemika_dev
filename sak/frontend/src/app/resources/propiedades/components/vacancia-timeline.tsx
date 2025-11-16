"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VACANCIA_STATE_STEPS, type Vacancia } from "../model";
import { cn } from "@/lib/utils";

type VacanciaTimelineProps = {
  vacancia?: Vacancia | null;
  title?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const VacanciaTimeline = ({ vacancia, title = "Ultimo ciclo de vacancia" }: VacanciaTimelineProps) => {
  if (!vacancia) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">La propiedad aun no registra vacancias.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={vacancia.ciclo_activo ? "default" : "outline"}>
            {vacancia.ciclo_activo ? "Ciclo activo" : "Ciclo cerrado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {VACANCIA_STATE_STEPS.map((step) => {
            const dateKey = step.dateField as keyof Vacancia;
            const commentKey = step.commentField as keyof Vacancia;
            const hasValue = Boolean(vacancia[dateKey]);

            return (
              <li key={step.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full mt-1",
                      hasValue ? "bg-primary" : "bg-muted border border-dashed"
                    )}
                  />
                  {step.key !== VACANCIA_STATE_STEPS[VACANCIA_STATE_STEPS.length - 1].key && (
                    <span className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(vacancia[dateKey] as string | undefined)}</p>
                  {vacancia[commentKey] ? (
                    <p className="rounded bg-muted px-3 py-2 text-sm">{vacancia[commentKey] as string}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin comentarios</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};

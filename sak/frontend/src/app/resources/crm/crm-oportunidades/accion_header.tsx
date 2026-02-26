"use client";

import { useGetOne } from "ra-core";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CRMOportunidad } from "./model";
import { formatDateValue } from "./model";

type AccionOportunidadHeaderProps = {
  oportunidad?: Pick<
    CRMOportunidad,
    "id" | "fecha_estado" | "created_at" | "contacto_id" | "titulo" | "descripcion_estado"
  > | null;
  compact?: boolean;
};

export const AccionOportunidadHeader = ({
  oportunidad,
  compact = false,
}: AccionOportunidadHeaderProps) => {
  const contactoId = oportunidad?.contacto_id ?? null;
  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const contactoLabel =
    contacto?.nombre_completo ??
    contacto?.nombre ??
    (contactoId ? `Contacto #${contactoId}` : "Sin contacto");
  const oportunidadId = oportunidad?.id ? `#${String(oportunidad.id).padStart(6, "0")}` : "Sin oportunidad";
  const fechaLabel = formatDateValue(oportunidad?.fecha_estado ?? oportunidad?.created_at ?? null);
  const oportunidadTitulo = oportunidad?.titulo ?? oportunidad?.descripcion_estado ?? "Sin titulo";

  return (
    <Card
      className={cn(
        compact
          ? "rounded-md border border-border/70 bg-muted/10 p-1.5 text-[9px] sm:text-[10px] shadow-sm"
          : "rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 shadow-lg",
      )}
    >
      <div className={cn("grid gap-4 sm:grid-cols-2", compact && "gap-1")}>
        <div className={cn("space-y-1 sm:col-span-2", compact && "space-y-0.5")}>
          <p
            className={cn(
              "text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]",
              compact && "text-[6.5px] tracking-[0.16em] sm:text-[7px]",
            )}
          >
            Oportunidad
          </p>
          <p
            className={cn(
              "text-xs font-semibold text-slate-900 sm:text-sm",
              compact && "text-[9px] sm:text-[10px]",
            )}
          >
            {oportunidadId} - {oportunidadTitulo}
          </p>
        </div>
        <div className={cn("space-y-1", compact && "space-y-0.5")}>
          <p
            className={cn(
              "text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]",
              compact && "text-[6.5px] tracking-[0.16em] sm:text-[7px]",
            )}
          >
            Contacto
          </p>
          <p className={cn("text-xs text-slate-700 sm:text-sm", compact && "text-[9px] sm:text-[10px]")}>
            {contactoLabel}
          </p>
        </div>
        <div className={cn("space-y-1", compact && "space-y-0.5")}>
          <p
            className={cn(
              "text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]",
              compact && "text-[6.5px] tracking-[0.16em] sm:text-[7px]",
            )}
          >
            Fecha
          </p>
          <p className={cn("text-xs text-slate-700 sm:text-sm", compact && "text-[9px] sm:text-[10px]")}>
            {fechaLabel}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default AccionOportunidadHeader;


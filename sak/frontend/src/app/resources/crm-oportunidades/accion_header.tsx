"use client";

import { useGetOne } from "ra-core";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "./model";
import { formatDateValue } from "./model";

type AccionOportunidadHeaderProps = {
  oportunidad?: Pick<
    CRMOportunidad,
    "id" | "fecha_estado" | "created_at" | "contacto_id" | "titulo" | "descripcion_estado"
  > | null;
};

export const AccionOportunidadHeader = ({ oportunidad }: AccionOportunidadHeaderProps) => {
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
    <Card className="rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 shadow-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]">
            Oportunidad
          </p>
          <p className="text-xs font-semibold text-slate-900 sm:text-sm">
            {oportunidadId} - {oportunidadTitulo}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]">
            Contacto
          </p>
          <p className="text-xs text-slate-700 sm:text-sm">{contactoLabel}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground sm:text-[10px] sm:tracking-[0.3em]">
            Fecha
          </p>
          <p className="text-xs text-slate-700 sm:text-sm">{fechaLabel}</p>
        </div>
      </div>
    </Card>
  );
};

export default AccionOportunidadHeader;


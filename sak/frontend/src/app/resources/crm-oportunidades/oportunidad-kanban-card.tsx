"use client";

import { ChevronRight, Building2, User } from "lucide-react";
import type { CRMOportunidad } from "./model";
import {
  KanbanCardWithCollapse,
  KanbanMeta,
  KanbanMetaRow,
} from "@/components/kanban/card";
import {
  formatOportunidadTitulo,
  getCardStyle,
  getContactoName,
  getPropiedadName,
  formatMonto,
  type BucketKey,
} from "./oportunidad-helpers";
import { getCardConfig } from "./oportunidad-card-config";

// Componente de tarjeta kanban para oportunidades

export interface CRMOportunidadKanbanCardProps {
  oportunidad: CRMOportunidad;
  bucketKey?: BucketKey;
  collapsed?: boolean;
  updating?: boolean;
  onToggleCollapse?: () => void;
  onEdit?: (oportunidad: CRMOportunidad) => void;
  onAgendar?: (oportunidad: CRMOportunidad) => void;
  onCotizar?: (oportunidad: CRMOportunidad) => void;
  onCerrar?: (oportunidad: CRMOportunidad) => void;
  onDescartar?: (oportunidad: CRMOportunidad) => void;
}

// Normalizar estado (si viene con formato diferente)
const normalizeEstado = (estado?: string | null): BucketKey => {
  if (!estado) return "1-abierta";
  return estado as BucketKey;
};

export const CRMOportunidadKanbanCard = ({
  oportunidad,
  bucketKey: _bucketKey,
  collapsed = false,
  updating = false,
  onToggleCollapse,
  onEdit,
  onAgendar,
  onCotizar,
  onCerrar,
  onDescartar,
}: CRMOportunidadKanbanCardProps) => {
  const estado = normalizeEstado(oportunidad.estado);
  
  // Obtener configuración declarativa basada en el estado
  const config = getCardConfig(
    oportunidad,
    estado,
    { onEdit, onAgendar, onCotizar, onCerrar, onDescartar },
    updating
  );

  // Body content (solo se muestra cuando no está colapsado)
  const body = (
    <KanbanMeta className="bg-slate-50/80">
      <KanbanMetaRow icon={<User className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getContactoName(oportunidad)}</span>
      </KanbanMetaRow>
      <KanbanMetaRow icon={<Building2 className="h-3 w-3 shrink-0 text-slate-400" />}>
        <span className="text-[11px]">{getPropiedadName(oportunidad)}</span>
      </KanbanMetaRow>
      {oportunidad.monto && (
        <KanbanMetaRow icon={<ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}>
          <span className="text-[11px] font-semibold text-slate-700">{formatMonto(oportunidad)}</span>
        </KanbanMetaRow>
      )}
    </KanbanMeta>
  );

  return (
    <KanbanCardWithCollapse
      id={oportunidad.id}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      header={{
        left: config.headerLeft,
        right: config.headerRight,
      }}
      title={formatOportunidadTitulo(oportunidad)}
      body={body}
      actions={config.actions}
      className={getCardStyle(estado)}
    />
  );
};

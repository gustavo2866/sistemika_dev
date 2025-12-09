"use client";

import { useState } from "react";
import { useGetList } from "ra-core";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CRMOportunidad } from "./model";

interface CRMOportunidadAceptarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CRMOportunidad;
  onComplete: (data: {
    titulo: string;
    tipo_operacion_id: number | null;
    tipo_propiedad_id: number | null;
    emprendimiento_id: number | null;
    descripcion_estado: string;
  }) => void;
  isProcessing: boolean;
}

export const CRMOportunidadAceptarDialog = ({
  open,
  onOpenChange,
  record,
  onComplete,
  isProcessing,
}: CRMOportunidadAceptarDialogProps) => {
  const [formData, setFormData] = useState({
    titulo: record.titulo || "",
    tipo_operacion_id: record.tipo_operacion_id || null,
    tipo_propiedad_id: record.tipo_propiedad_id || null,
    emprendimiento_id: record.emprendimiento_id || null,
    descripcion_estado: record.descripcion_estado || "",
  });

  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { data: tiposPropiedad } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { data: emprendimientos } = useGetList("emprendimientos", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onComplete(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completar Oportunidad</DialogTitle>
          <DialogDescription>
            Completa los datos generales para mover la oportunidad a estado Abierta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <input
                id="titulo"
                type="text"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.titulo}
                onChange={(event) => setFormData({ ...formData, titulo: event.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_operacion">Tipo de operación *</Label>
                <select
                  id="tipo_operacion"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.tipo_operacion_id ?? ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      tipo_operacion_id: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  required
                >
                  <option value="">Seleccionar...</option>
                  {tiposOperacion?.map((tipo: any) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="tipo_propiedad">Tipo de propiedad</Label>
                <select
                  id="tipo_propiedad"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.tipo_propiedad_id ?? ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      tipo_propiedad_id: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                >
                  <option value="">Seleccionar...</option>
                  {tiposPropiedad?.map((tipo: any) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="emprendimiento">Emprendimiento</Label>
              <select
                id="emprendimiento"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.emprendimiento_id ?? ""}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    emprendimiento_id: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">Seleccionar...</option>
                {emprendimientos?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.descripcion_estado}
                onChange={(event) =>
                  setFormData({ ...formData, descripcion_estado: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Completar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CRMOportunidadAceptarDialog;

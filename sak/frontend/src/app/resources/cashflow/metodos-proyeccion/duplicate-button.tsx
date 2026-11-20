"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { useNotify, useRecordContext } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/dataProvider";
import type { MetodoProyeccion } from "./model";

export const DuplicateMetodoProyeccionButton = () => {
  const record = useRecordContext<MetodoProyeccion>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !record || record.tipo_calculo !== "HISTORICO";

  const duplicate = async () => {
    if (disabled || saving || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/metodos-proyeccion/${record.id}/duplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nombre: name.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "No se pudo duplicar el método");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["metodos-proyeccion", "getList"] });
      notify(`Método "${result.nombre}" creado con sus reglas de cálculo.`, { type: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo duplicar el método");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled || saving}
      title={disabled ? "Los métodos Relacional y Pendiente no se pueden duplicar" : "Duplicar método de proyección"}
      onClick={() => {
        setName(`${record?.nombre ?? ""} (copia)`.slice(0, 200));
        setError(null);
        setOpen(true);
      }}>
      <Copy className="mr-1.5 size-4" />Duplicar
    </Button>
    <Confirm isOpen={open} title="Duplicar método de proyección" confirm={saving ? "Duplicando…" : "Duplicar"}
      confirmDisabled={disabled || !name.trim()} loading={saving} ConfirmIcon={saving ? Loader2 : Copy}
      onClose={() => { if (!saving) setOpen(false); }} onConfirm={() => void duplicate()}
      content={<div className="space-y-3">
        <DialogDescription>
          Se copiará la configuración guardada de &quot;{record?.nombre}&quot; y sus reglas de cálculo.
        </DialogDescription>
        <div className="space-y-1.5">
          <Label htmlFor="duplicate-projection-method-name">Nombre de la copia</Label>
          <Input id="duplicate-projection-method-name" value={name} maxLength={200} autoFocus
            disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? "duplicate-projection-method-error" : undefined}
            onChange={(event) => { setName(event.target.value); setError(null); }} />
        </div>
        {error && <p id="duplicate-projection-method-error" role="alert" className="text-sm text-destructive">{error}</p>}
      </div>} />
  </>;
};

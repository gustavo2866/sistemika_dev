"use client";

import { Create } from "@/components/create";
import { PoOrderForm } from "./form";
import { computeDetalleImporte, computePoOrderTotal } from "./model";

export const PoOrderCreate = () => (
  <Create
    redirect="list"
    title="Crear Orden"
    transform={(data: any) => {
      const detalles = (data.detalles ?? []).map((d: any) => ({
        ...d,
        importe: computeDetalleImporte(d),
      }));
      return {
        ...data,
        detalles,
        total: computePoOrderTotal(detalles),
      };
    }}
  >
    <PoOrderForm />
  </Create>
);


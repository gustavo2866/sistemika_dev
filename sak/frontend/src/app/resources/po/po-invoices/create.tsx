"use client";

import { Create } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { PoInvoiceForm } from "./form";
import { getInvoiceStatusBadgeClass, normalizePoInvoicePayload } from "./model";

// Titulo del formulario de alta de Factura OC.
const PoInvoiceCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear Factura OC</span>
    <Badge
      variant="secondary"
      className={getInvoiceStatusBadgeClass("borrador")}
    >
      Borrador
    </Badge>
  </div>
);

// Wrapper de create para Factura OC.
export const PoInvoiceCreate = () => (
  <Create
    redirect="list"
    title={<PoInvoiceCreateTitle />}
    transform={(data: any) => normalizePoInvoicePayload(data)}
  >
    <PoInvoiceForm />
  </Create>
);

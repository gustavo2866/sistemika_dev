"use client";

import { Link } from "react-router-dom";
import { useCreatePath } from "ra-core";

const setupLinks = [
  {
    label: "Articulos",
    description: "Gestion de articulos para compras.",
    resource: "articulos",
  },
  {
    label: "Tipos de articulo",
    description: "Configurar tipos de articulo para compras.",
    resource: "tipos-articulo",
  },
  {
    label: "Tipos de solicitud",
    description: "Configurar tipos de solicitud de compras.",
    resource: "tipos-solicitud",
  },
  {
    label: "Estados de orden",
    description: "Configurar estados de orden de compra.",
    resource: "po-order-status",
  },
  {
    label: "Estados de factura",
    description: "Configurar estados de factura de compra.",
    resource: "po-invoice-status",
  },
  {
    label: "Departamentos",
    description: "Administrar departamentos para imputacion.",
    resource: "departamentos",
  },
];

export const PoSetupPage = () => {
  const createPath = useCreatePath();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Setup Compras</h1>
        <p className="text-muted-foreground">
          Accesos directos para configurar entidades de compras.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {setupLinks.map((link) => {
          const to = createPath({
            resource: link.resource,
            type: "list",
          });
          return (
            <Link
              key={link.resource}
              to={to}
              className="rounded-lg border border-border bg-card p-4 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <h2 className="text-lg font-medium">{link.label}</h2>
              <p className="text-sm text-muted-foreground">{link.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default PoSetupPage;

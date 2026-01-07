"use client";

import { Link } from "react-router-dom";
import { useCreatePath } from "ra-core";

const catalogLinks = [
  {
    label: "Tipos de Operación",
    description: "Administrar pipeline y operaciones disponibles.",
    resource: "crm/catalogos/tipos-operacion",
  },
  {
    label: "Motivos de Pérdida",
    description: "Razones para registrar oportunidades perdidas.",
    resource: "crm/catalogos/motivos-perdida",
  },
  {
    label: "Condiciones de Pago",
    description: "Términos de cobro/financiación ofrecidos.",
    resource: "crm/catalogos/condiciones-pago",
  },
  {
    label: "Tipos de Evento",
    description: "Clasificaciones de actividades comerciales.",
    resource: "crm/catalogos/tipos-evento",
  },
  {
    label: "Motivos de Evento",
    description: "Disparadores o resultados de cada evento.",
    resource: "crm/catalogos/motivos-evento",
  },
  {
    label: "Respuestas",
    description: "Respuestas rapidas para el equipo.",
    resource: "crm/catalogos/respuestas",
  },
  {
    label: "Monedas",
    description: "Monedas disponibles (entidad cross).",
    resource: "monedas",
  },
  {
    label: "Cotizaciones",
    description: "Tipos de cambio entre monedas.",
    resource: "crm/cotizaciones",
  },
];

export const CRMSetupPage = () => {
  const createPath = useCreatePath();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuración CRM</h1>
        <p className="text-muted-foreground">
          Accesos directos para mantener los catálogos del módulo CRM.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogLinks.map((link) => {
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

export default CRMSetupPage;

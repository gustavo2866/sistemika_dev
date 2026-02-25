"use client";

import { Link } from "react-router-dom";
import { useCreatePath } from "ra-core";

const setupLinks = [
  {
    label: "Tipos de propiedad",
    description: "Configurar los tipos de propiedad.",
    resource: "tipos-propiedad",
  },
  {
    label: "Estados de propiedad",
    description: "Configurar estados y flujos de propiedad.",
    resource: "propiedades-status",
  },
  {
    label: "Log estados de propiedad",
    description: "Auditoria de cambios de estado de propiedades.",
    resource: "propiedades-log-status",
  },
  {
    label: "Propietarios",
    description: "Administrar propietarios vinculados a inmuebles.",
    resource: "propietarios",
  },
  {
    label: "Tipos de actualizacion",
    description: "Configurar tipos de actualizacion de contratos.",
    resource: "tipos-actualizacion",
  },
];

export const InmobiliariaSetupPage = () => {
  const createPath = useCreatePath();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Setup Inmobiliaria</h1>
        <p className="text-muted-foreground">
          Accesos directos para configurar entidades de inmobiliaria.
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

export default InmobiliariaSetupPage;

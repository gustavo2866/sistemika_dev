/**
 * Pantalla de creacion de PoSolicitudes.
 *
 * Estructura:
 * 1. WIZARD - Wrapper para el asistente
 * 2. CREATE - Componente principal de alta
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useDataProvider,
  useNotify,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { Create } from "@/components/create";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { PoSolicitudForm } from "./form";
import { wizard_create as WizardCreate } from "./wizard_create";
import { buildPoSolicitudPayload } from "./model";
import type { PoSolicitudPayload, WizardCreatePayload } from "./model";

//******************************* */
// region 1. WIZARD

// Wrapper del wizard asistido.
const PoSolicitudWizard = ({
  open,
  onOpenChange,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: string | null;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();
  const resource = useResourceContext();

  if (variant !== "asistida") {
    return null;
  }

  const handleApplyWizard = async (payload: WizardCreatePayload) => {
    if (!resource) {
      notify("No se pudo crear la solicitud", { type: "warning" });
      return;
    }
    const normalizedPayload = buildPoSolicitudPayload(payload as PoSolicitudPayload);
    const response = await dataProvider.create(resource, { data: normalizedPayload });
    const recordId = response?.data?.id;
    if (recordId == null) {
      notify("No se pudo crear la solicitud", { type: "warning" });
      return;
    }
    onOpenChange(false);
    redirect("edit", resource, recordId);
  };

  return (
    <WizardCreate
      open={open}
      onOpenChange={onOpenChange}
      onApply={handleApplyWizard}
    />
  );
};
// endregion

//******************************* */
// region 2. CREATE

export const PoSolicitudCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const wizardParam = params.get("wizard");
  const [wizardOpen, setWizardOpen] = useState(Boolean(wizardParam));
  const returnTo = useMemo(() => getReturnToFromLocation(location), [location]);

  useEffect(() => {
    if (wizardParam) {
      setWizardOpen(true);
    }
  }, [wizardParam]);

  return (
    <Create
      redirect={false}
      title="Nueva Solicitud"
      className="w-full max-w-lg"
      actions={null}
      transform={(data) => buildPoSolicitudPayload(data as PoSolicitudPayload)}
      mutationOptions={{
        onSuccess: () => {
          const target = returnTo ?? "/po-solicitudes";
          navigate(target, { state: { refresh: true } });
        },
      }}
    >
      <div className="w-full max-w-lg">
        <PoSolicitudForm>
          <PoSolicitudWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            variant={wizardParam}
          />
        </PoSolicitudForm>
      </div>
    </Create>
  );
};
// endregion


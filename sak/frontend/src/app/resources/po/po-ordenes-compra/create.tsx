/**
 * Pantalla de creacion de Ordenes de Compra.
 *
 * Estructura:
 * 1. WIZARD - Wrapper para el asistente
 * 2. CREATE - Componente principal de alta
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFormContext } from "react-hook-form";
import { Create } from "@/components/create";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { PoOrdenCompraForm } from "./form";
import { wizard_create as WizardCreate } from "./wizard_create";
import { buildPoOrdenCompraPayload } from "./transformers";
import type { PoOrdenCompraPayload, WizardPayload } from "./model";
import { applyWizardPayload } from "./form_hooks";
import type { PoOrdenCompra } from "./model";

//******************************* */
// region 1. WIZARD

// Wrapper del wizard asistido.
const PoOrdenCompraWizard = ({
  open,
  onOpenChange,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: string | null;
}) => {
  const form = useFormContext<PoOrdenCompra>();

  if (variant !== "asistida") {
    return null;
  }

  const handleApplyWizard = async (payload: WizardPayload) => {
    applyWizardPayload({
      isCreate: true,
      setValue: form.setValue,
      payload,
    });
    onOpenChange(false);
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

export const PoOrdenCompraCreate = () => {
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
      title="Nueva Orden de Compra"
      className="w-full max-w-lg"
      actions={null}
      transform={(data) => buildPoOrdenCompraPayload(data as PoOrdenCompraPayload)}
      mutationOptions={{
        onSuccess: () => {
          const target = returnTo ?? "/po-ordenes-compra";
          navigate(target, { state: { refresh: true } });
        },
      }}
    >
      <div className="w-full max-w-lg">
        <PoOrdenCompraForm>
          <PoOrdenCompraWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            variant={wizardParam}
          />
        </PoOrdenCompraForm>
      </div>
    </Create>
  );
};
// endregion


"use client";

import { Create } from "@/components/create";
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useGetIdentity } from "ra-core";
import { useFormContext } from "react-hook-form";
import { PoSolicitudForm } from "./form";
import { create_wizard_3 as CreateWizard3 } from "./create_wizard_3";
import { applyWizardPayload } from "./form_hooks";
import type { PoSolicitud, WizardPayload } from "./model";

const PoSolicitudWizard = ({
  open,
  onOpenChange,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: string | null;
}) => {
  const form = useFormContext<PoSolicitud>();
  const { data: identity } = useGetIdentity();

  if (variant !== "asistida") {
    return null;
  }

  const handleApplyWizard = (payload: WizardPayload) => {
    const identityId =
      identity?.id != null && Number.isFinite(Number(identity.id))
        ? Number(identity.id)
        : null;
    applyWizardPayload({
      isCreate: true,
      setValue: form.setValue,
      identityId,
      payload,
    });
  };

  return (
    <CreateWizard3
      open={open}
      onOpenChange={onOpenChange}
      onApply={handleApplyWizard}
    />
  );
};

export const PoSolicitudCreate = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const wizardParam = params.get("wizard");
  const [wizardOpen, setWizardOpen] = useState(Boolean(wizardParam));

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


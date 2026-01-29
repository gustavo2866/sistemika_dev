"use client";

import { Create } from "@/components/create";
import { PoFacturaForm } from "./form";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const PoFacturaCreate = () => {
  const location = useLocation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnTo") ?? "list";
  }, [location.search]);

  return (
    <Create
      redirect={redirectTo}
      title="Nueva Factura"
      className="w-full max-w-lg"
      actions={
        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
            onClick={() => setWizardOpen(true)}
          >
            <Sparkles className="size-3 sm:size-4" />
            Asistente
          </Button>
        </div>
      }
    >
      <div className="w-full max-w-lg">
        <PoFacturaForm
          wizardOpen={wizardOpen}
          setWizardOpen={setWizardOpen}
        />
      </div>
    </Create>
  );
};

"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import FormExample from "../../components/form-example";

export default function InstallationPage() {
  const [open, setOpen] = useState(false);
  const [openSimple, setOpenSimple] = useState(false);

  // Si necesitas soportar 'indeterminate', puedes usar: useState<boolean | "indeterminate">(false)
  return (
     
    <div className="p-8 space-y-6">
      <Button onClick={() => setOpen(true)}>Abrir Formulario</Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px]">
            <FormExample onClose={() => setOpen(false)} />
          </div>
        </div>
      )}


    </div>
     
  );

}

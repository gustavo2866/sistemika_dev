"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@workspace/ui/components/dialog";
import FormExample from "../../components/form-example";

export default function InstallationPage() {
  const [open, setOpen] = useState(false);
  const [openSimple, setOpenSimple] = useState(false);

  // Si necesitas soportar 'indeterminate', puedes usar: useState<boolean | "indeterminate">(false)
  return (
     
    <div className="p-8 space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Abrir Formulario</Button>
        </DialogTrigger>
        <DialogContent className="min-w-[350px]">
          <DialogTitle>Formulario de ejemplo</DialogTitle>
          <DialogDescription>Completa los campos y envía el formulario. Todos los datos son requeridos salvo donde se indique lo contrario.</DialogDescription>
          <FormExample onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
     
  );

}

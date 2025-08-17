"use client";
import React, { useState } from "react";
import FormExample from "./form-example";
import ZodFormExample from "@workspace/core/src/components/form/Form_Simple";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";

export default function Page() {
  const [open, setOpen] = useState(false);
  const [openSimple, setOpenSimple] = useState(false);
  const [checked, setChecked] = useState<boolean | "indeterminate">(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [notes, setNotes] = useState("");
  const [country, setCountry] = useState("ar");
  // Si necesitas soportar 'indeterminate', puedes usar: useState<boolean | "indeterminate">(false)
  return (
    <div className="p-8 space-y-6">
      <Button onClick={() => setOpen(true)}>Abrir Formulario</Button>
      <Button onClick={() => setOpenSimple(true)} variant="secondary">Abrir Form Simple</Button>
      <div className="space-y-4 p-4 border rounded-lg bg-white">
        <div>
          <label htmlFor="ui-name" className="block mb-1">Nombre (Input UI)</label>
          <Input id="ui-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" />
        </div>
        <div>
          <label htmlFor="ui-email" className="block mb-1">Email (Input UI)</label>
          <Input id="ui-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        </div>
        <div>
          <label htmlFor="ui-role" className="block mb-1">Rol (Select UI)</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuario</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="ui-country" className="block mb-1">País (Select UI)</label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un país" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">Argentina</SelectItem>
              <SelectItem value="br">Brasil</SelectItem>
              <SelectItem value="uy">Uruguay</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={setChecked} id="ui-checkbox" />
          <label htmlFor="ui-checkbox">Suscribirse (Checkbox UI)</label>
        </div>
        <div>
          <label htmlFor="ui-notes" className="block mb-1">Notas (Textarea UI)</label>
          <Textarea id="ui-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales" />
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px]">
            <FormExample onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
      {openSimple && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-4 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl"
              onClick={() => setOpenSimple(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <ZodFormExample 
              onClose={() => setOpenSimple(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

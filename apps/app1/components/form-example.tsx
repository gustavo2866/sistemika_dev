"use client";
import React from "react";
import { Form_Base } from "@workspace/core/components/form/Form_Base";

// Definición de campos y valores iniciales
const fields = [
  {
    name: "name",
    label: "Nombre",
    type: "text" as const,
    required: true,
    placeholder: "Nombre",
    rules: { required: "El nombre es obligatorio", minLength: { value: 2, message: "Mínimo 2 caracteres" } }
  },
  {
    name: "email",
    label: "Email",
    type: "email" as const,
    required: true,
    placeholder: "Email",
    rules: { required: "El email es obligatorio", pattern: { value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, message: "Email inválido" } }
  },
  {
    name: "role",
    label: "Rol",
    type: "select" as const,
    required: true,
    options: [ { value: "user", label: "Usuario" }, { value: "admin", label: "Administrador" } ],
    rules: { required: "Selecciona un rol" }
  },
  {
    name: "country",
    label: "País",
    type: "select" as const,
    required: false,
    options: [ { value: "ar", label: "Argentina" }, { value: "br", label: "Brasil" }, { value: "uy", label: "Uruguay" } ],
    rules: {}
  },
  {
    name: "subscribe",
    label: "Suscribirse",
    type: "checkbox" as const,
    rules: {}
  },
  {
    name: "notes",
    label: "Notas",
    type: "textarea" as const,
    placeholder: "Notas adicionales",
    rules: { maxLength: { value: 100, message: "Máximo 100 caracteres" } }
  },
];

// Valores por defecto para el formulario
const defaultValues = { name: "", email: "", role: "user", subscribe: false, notes: "" };

export default function FormExample({ onClose }: { onClose?: () => void }) {
  return (
    <Form_Base
      title="Formulario de ejemplo"
      fields={fields}
      defaultValues={defaultValues}
      onSubmit={(data: any) => { alert(JSON.stringify(data)); onClose?.(); }}
      onExit={onClose}
      // footer={<span>Ejemplo de footer</span>}
    />
  );
}

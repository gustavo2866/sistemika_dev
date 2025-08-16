import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@workspace/ui/components/card";
import { useForm_Base } from "./useForm_Base.tsx";

export interface FormBaseProps {
  title?: string;
  footer?: React.ReactNode;
  fields: any[];
  defaultValues?: Record<string, any>;
  onSubmit?: (data: any) => void;
  onExit?: () => void;
}

export function Form_Base(props: FormBaseProps) {
  const form = useForm_Base({
    fields: props.fields,
    defaultValues: props.defaultValues,
    onSubmit: props.onSubmit,
  });


  // Renderiza el formulario completo y lo envuelve con cabecera, cuerpo y pie ordenados
  return (
    <Card className="p-4 md:p-6 max-w-md mx-auto">
      {props.title && (
        <CardHeader className="bg-gray-50 mb-1 rounded-t-md px-6 shadow-sm">
          <CardTitle className="py-2 bg-gray-50 rounded-md shadow-sm">{props.title}</CardTitle>
        </CardHeader>
      )}
      <form
        onSubmit={form.handleSubmit(props.onSubmit || (() => {}))}
        className="contents"
      >
        <CardContent className="space-y-4 pt-1 pb-2">
          {/* Renderiza los campos dinámicos usando los props del hook */}
          {props.fields.map((field) => {
            const fieldElement = form.renderField(field);
            return fieldElement || null;
          })}
        </CardContent>
        <CardFooter className="border-t pt-2 pb-1 flex w-full justify-end gap-2">
          <Button type="submit" size="sm" className="w-[120px]">Enviar</Button>
          {props.onExit && (
            <Button type="button" variant="outline" size="sm" className="w-[120px]" onClick={props.onExit}>Cancelar</Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

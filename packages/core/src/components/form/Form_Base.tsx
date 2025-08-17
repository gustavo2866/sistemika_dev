import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card,  CardHeader,  CardTitle,  CardContent,  CardFooter,} from "@workspace/ui/components/card";
import { FormProvider } from "react-hook-form";
import { useForm_Base } from "./useForm_Base.tsx";

export interface FormBaseProps {
  title?: string;
  footer?: React.ReactNode;
  fields: any[]; // o FormFieldDef[]
  defaultValues?: Record<string, any>;
  onSubmit?: (data: any) => void;
  onExit?: () => void;
  mode?: Parameters<typeof useForm_Base>[0]["mode"];
  resolver?: Parameters<typeof useForm_Base>[0]["resolver"];
}

export function Form_Base(props: FormBaseProps) {
  const form = useForm_Base({
    fields: props.fields,
    defaultValues: props.defaultValues,
    onSubmit: props.onSubmit,
    mode: props.mode,
    resolver: props.resolver,
  });

  return (
    <FormProvider {...form}>
       
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-center">
          {props.title}
        </CardTitle>
      </CardHeader>

      <form onSubmit={form.handleSubmit(props.onSubmit || (() => {}))} noValidate>

          <CardContent className="space-y-4">
            {props.fields.map((f) => form.renderField(f))}
          </CardContent>

          <CardFooter className="border-t border-gray-200 px-4 py-3 flex w-full justify-end gap-2">
            {props.footer ? (
              props.footer
            ) : (
              <>
                {props.onExit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-[120px]"
                    onClick={props.onExit}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="w-[120px]"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Enviando..." : "Enviar"}
                </Button>
              </>
            )}
          </CardFooter>

      </form>

      
 
    </FormProvider>
  );
}

"use client";

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Calculator, DollarSign, Calendar, Percent, Settings } from "lucide-react";
import { useForm } from "react-hook-form";
import type { 
  SistemaCalculo 
} from "@/types/calculadora";
import { sistemasCalculoOptions } from "@/types/calculadora";
import { useCalculadora } from "@/hooks/useCalculadora";
import { ResumenResultados } from "./resumen-resultados";
import { TablaDetalle } from "./tabla-detalle";

interface CalculoFormData {
  capital: number;
  plazo_meses: number;
  tna: number;
  sistema: SistemaCalculo;
  iva_porcentaje: number;
}

export function CalculadoraFinanciera() {
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const {
    isLoading,
    error,
    resultado,
    resumen,
    calcularCompleto,
    calcularResumen,
    limpiar
  } = useCalculadora();

  const form = useForm<CalculoFormData>({
    defaultValues: {
      capital: 1000000,
      plazo_meses: 12,
      tna: 24.0,
      sistema: "frances" as SistemaCalculo,
      iva_porcentaje: 10.5,
    },
  });

  const onSubmit = async (data: CalculoFormData) => {
    if (mostrarDetalle) {
      await calcularCompleto(data);
    } else {
      await calcularResumen(data);
    }
  };

  const formatCurrency = (value: number | undefined): string => {
    if (!value) return "$0";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number | undefined): string => {
    if (!value) return "0%";
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora Financiera
          </CardTitle>
          <CardDescription>
            Calcula préstamos con sistema Francés (cuotas constantes) o Alemán (cuotas decrecientes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4" />
                    Capital Inicial
                  </label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    {...form.register("capital", { valueAsNumber: true })}
                  />
                  <div className="text-sm text-gray-600">
                    Monto inicial del préstamo en pesos
                  </div>
                  {form.formState.errors.capital && (
                    <div className="text-sm text-red-600">
                      {form.formState.errors.capital.message}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    Plazo en Meses
                  </label>
                  <Input
                    type="number"
                    placeholder="12"
                    {...form.register("plazo_meses", { valueAsNumber: true })}
                  />
                  <div className="text-sm text-gray-600">
                    Duración del préstamo (máximo 600 meses)
                  </div>
                  {form.formState.errors.plazo_meses && (
                    <div className="text-sm text-red-600">
                      {form.formState.errors.plazo_meses.message}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Percent className="h-4 w-4" />
                    Tasa Nominal Anual (TNA)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="24.00"
                    {...form.register("tna", { valueAsNumber: true })}
                  />
                  <div className="text-sm text-gray-600">
                    Tasa anual en porcentaje (ej: 24.00 para 24%)
                  </div>
                  {form.formState.errors.tna && (
                    <div className="text-sm text-red-600">
                      {form.formState.errors.tna.message}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Settings className="h-4 w-4" />
                    Sistema de Cálculo
                  </label>
                  <Select onValueChange={(value) => form.setValue("sistema", value as SistemaCalculo)} defaultValue={form.watch("sistema")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sistema" />
                    </SelectTrigger>
                    <SelectContent>
                      {sistemasCalculoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-gray-600">
                    Francés: cuotas iguales | Alemán: cuotas decrecientes
                  </div>
                  {form.formState.errors.sistema && (
                    <div className="text-sm text-red-600">
                      {form.formState.errors.sistema.message}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">IVA sobre Intereses (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10.50"
                    {...form.register("iva_porcentaje", { valueAsNumber: true })}
                  />
                  <div className="text-sm text-gray-600">
                    Porcentaje de IVA aplicado a los intereses
                  </div>
                  {form.formState.errors.iva_porcentaje && (
                    <div className="text-sm text-red-600">
                      {form.formState.errors.iva_porcentaje.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  onClick={() => setMostrarDetalle(false)}
                  className="flex-1"
                >
                  {isLoading ? "Calculando..." : "Calcular Resumen"}
                </Button>
                <Button 
                  type="submit" 
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => setMostrarDetalle(true)}
                  className="flex-1"
                >
                  {isLoading ? "Calculando..." : "Calcular con Detalle"}
                </Button>
                {(resultado || resumen) && (
                  <Button 
                    type="button"
                    variant="secondary"
                    onClick={limpiar}
                    disabled={isLoading}
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {error}
                  </p>
                </div>
              )}
            </form>
        </CardContent>
      </Card>

      {resumen && <ResumenResultados resumen={resumen} formatCurrency={formatCurrency} formatPercentage={formatPercentage} />}
      {resultado && <TablaDetalle resultado={resultado} formatCurrency={formatCurrency} formatPercentage={formatPercentage} />}
    </div>
  );
}

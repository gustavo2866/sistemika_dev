"use client";

import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Percent,
  Calculator
} from "lucide-react";
import type { ResumenCalculo } from "@/types/calculadora";

interface ResumenResultadosProps {
  resumen: ResumenCalculo;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}

export function ResumenResultados({ 
  resumen, 
  formatCurrency, 
  formatPercentage 
}: ResumenResultadosProps) {
  const sistemaIcon = resumen.sistema === "frances" ? TrendingUp : TrendingDown;
  const sistemaLabel = resumen.sistema === "frances" ? "Francés" : "Alemán";
  const sistemaDescription = resumen.sistema === "frances" 
    ? "Cuotas constantes" 
    : "Cuotas decrecientes";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Resumen del Cálculo
        </CardTitle>
        <CardDescription>
          Resultados del sistema {sistemaLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Parámetros de entrada */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Parámetros del Préstamo
            <Badge variant="outline" className="flex items-center gap-1">
              {React.createElement(sistemaIcon, { className: "h-3 w-3" })}
              {sistemaLabel} - {sistemaDescription}
            </Badge>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Capital Inicial
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(resumen.capital)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Plazo
              </div>
              <div className="text-lg font-semibold">
                {resumen.plazo_meses} meses
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                TNA
              </div>
              <div className="text-lg font-semibold">
                {formatPercentage(resumen.tna)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                TEM
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {formatPercentage(resumen.tem)}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Resultados de cuotas */}
        <div>
          <h3 className="font-semibold mb-3">Cuotas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      {resumen.sistema === "frances" ? "Cuota Fija" : "Primera Cuota"}
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatCurrency(resumen.cuota_inicial)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            {resumen.sistema === "aleman" && (
              <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        Última Cuota
                      </p>
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {formatCurrency(resumen.cuota_final)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Separator />

        {/* Resumen financiero */}
        <div>
          <h3 className="font-semibold mb-3">Resumen Financiero</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Intereses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(resumen.total_intereses)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total IVA</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(resumen.total_iva)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total a Pagar</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(resumen.total_a_pagar)}
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores adicionales */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Costo financiero total:</span>{" "}
              <span className="text-red-600 dark:text-red-400">
                {formatCurrency(resumen.total_intereses + resumen.total_iva)}
              </span>
            </div>
            <div>
              <span className="font-medium">Porcentaje sobre capital:</span>{" "}
              <span className="text-orange-600 dark:text-orange-400">
                {formatPercentage(((resumen.total_intereses + resumen.total_iva) / resumen.capital) * 100)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
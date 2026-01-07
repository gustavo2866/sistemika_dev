"use client";

import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import type { CalculoResponse, DetalleCuota } from "@/types/calculadora";
import { useState } from "react";

interface TablaDetalleProps {
  resultado: CalculoResponse;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}

export function TablaDetalle({ 
  resultado, 
  formatCurrency, 
  formatPercentage 
}: TablaDetalleProps) {
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const sistemaIcon = resultado.sistema === "frances" ? TrendingUp : TrendingDown;
  const sistemaLabel = resultado.sistema === "frances" ? "Francés" : "Alemán";
  
  // Mostrar solo las primeras 10 cuotas por defecto
  const cuotasAMostrar = mostrarTodas ? resultado.detalle_cuotas : resultado.detalle_cuotas.slice(0, 10);

  const exportarCSV = () => {
    const headers = [
      "Cuota",
      "Amortización",
      "Interés",
      "Cuota sin IVA",
      "IVA",
      "Cuota con IVA",
      "Saldo Deuda"
    ].join(",");

    const rows = resultado.detalle_cuotas.map(cuota => [
      cuota.numero_cuota,
      cuota.capital_periodo.toFixed(2),
      cuota.interes_periodo.toFixed(2),
      cuota.cuota_sin_iva.toFixed(2),
      cuota.iva_sobre_interes.toFixed(2),
      cuota.cuota_con_iva.toFixed(2),
      cuota.saldo_deuda.toFixed(2)
    ].join(","));

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `calculo_${sistemaLabel.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Resumen compacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalle de Cuotas - Sistema {sistemaLabel}
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              {React.createElement(sistemaIcon, { className: "h-3 w-3" })}
              {resultado.detalle_cuotas.length} cuotas
            </Badge>
          </CardTitle>
          <CardDescription>
            Capital: {formatCurrency(resultado.capital)} | 
            TNA: {formatPercentage(resultado.tna)} | 
            Total: {formatCurrency(resultado.total_a_pagar)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">TEM</p>
                <p className="font-semibold">{formatPercentage(resultado.tem)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Intereses</p>
                <p className="font-semibold text-red-600">{formatCurrency(resultado.total_intereses)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total IVA</p>
                <p className="font-semibold text-orange-600">{formatCurrency(resultado.total_iva)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {resultado.sistema === "frances" ? "Cuota Fija" : "1ra Cuota"}
                </p>
                <p className="font-semibold text-green-600">{formatCurrency(resultado.cuota_inicial)}</p>
              </div>
            </div>
            <Button onClick={exportarCSV} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de cuotas */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-[10px] leading-tight sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">Cuota #</TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">Amortizacion</span>
                    <span className="sm:hidden">Amort.</span>
                  </TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">Interes</span>
                    <span className="sm:hidden">Int.</span>
                  </TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">Cuota s/IVA</span>
                    <span className="sm:hidden">Cta s/IVA</span>
                  </TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">IVA</TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">Cuota c/IVA</span>
                    <span className="sm:hidden">Cta c/IVA</span>
                  </TableHead>
                  <TableHead className="text-right px-1 py-0.5 text-[9px] sm:px-2 sm:py-2 sm:text-xs">
                    <span className="hidden sm:inline">Saldo Deuda</span>
                    <span className="sm:hidden">Saldo</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuotasAMostrar.map((cuota, index) => (
                  <TableRow 
                    key={cuota.numero_cuota}
                    className={index % 2 === 0 ? "bg-muted/25" : ""}
                  >
                    <TableCell className="text-center font-medium px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {cuota.numero_cuota}
                    </TableCell>
                    <TableCell className="text-right font-mono px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.capital_periodo)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.interes_periodo)}
                    </TableCell>
                    <TableCell className="text-right font-mono px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.cuota_sin_iva)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600 px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.iva_sobre_interes)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.cuota_con_iva)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground px-1 py-0.5 text-[10px] sm:px-2 sm:py-2 sm:text-sm">
                      {formatCurrency(cuota.saldo_deuda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {resultado.detalle_cuotas.length > 10 && (
            <div className="p-4 border-t">
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setMostrarTodas(!mostrarTodas)}
                >
                  {mostrarTodas 
                    ? "Mostrar menos cuotas" 
                    : `Mostrar todas las ${resultado.detalle_cuotas.length} cuotas`
                  }
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">Capital Inicial</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(resultado.capital)}
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">Total Intereses</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(resultado.total_intereses)}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm text-orange-600 dark:text-orange-400">Total IVA</p>
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                {formatCurrency(resultado.total_iva)}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Total a Pagar</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(resultado.total_a_pagar)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

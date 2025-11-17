/**
 * Ejemplo de uso de los componentes Dashboard KPI
 * 
 * Este archivo muestra diferentes casos de uso de los componentes
 * de dashboard para crear tarjetas KPI variadas y reutilizables.
 */

import {
  DashboardKpiCard,
  KpiMetricsRow,
  KpiMetric,
  KpiDetails,
  KpiDetail,
  KpiAlert,
  KpiTrend,
  KpiBadge,
  KpiProgressBar,
  KpiSparkline,
  KpiDivider,
  KpiIcon,
} from "@/components/dashboard";
import { AlertCircle, Users, DollarSign } from "lucide-react";

export default function DashboardExample() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard KPI Components - Ejemplos</h1>

      {/* Grid de KPI Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ejemplo 1: Card básico */}
        <DashboardKpiCard title="Vacancias totales">
          <KpiMetricsRow>
            <KpiMetric value={150} label="Vacancias" />
            <KpiMetric value={3450} label="Días" className="text-right" />
          </KpiMetricsRow>
          
          <KpiDetails>
            <KpiDetail label="Propiedades" value={45} />
            <KpiDetail label="Costo" value="$2,500,000" />
            <KpiDetail label="Promedio" value="23.5 días" />
          </KpiDetails>
        </DashboardKpiCard>

        {/* Ejemplo 2: Card con alerta y variante danger */}
        <DashboardKpiCard 
          title="Vacancias activas" 
          variant="danger"
          onSelect={() => console.log("Card seleccionado")}
        >
          <KpiMetricsRow>
            <KpiMetric value={25} label="Vacancias" />
            <KpiMetric value={890} label="Días" className="text-right" />
          </KpiMetricsRow>
          
          <KpiDetails>
            <KpiDetail label="Propiedades" value={20} />
            <KpiDetail label="Costo" value="$1,100,000" />
          </KpiDetails>
          
          <KpiAlert 
            variant="danger"
            message="Revisar vacancias activas"
            icon={<AlertCircle className="h-4 w-4" />}
          />
        </DashboardKpiCard>

        {/* Ejemplo 3: Card con tendencia */}
        <DashboardKpiCard title="Ingresos mensuales" variant="success">
          <div className="flex items-center justify-between">
            <KpiMetric value="$850K" label="Este mes" />
            <KpiTrend 
              value={12} 
              percentage={12} 
              direction="up" 
              variant="positive" 
            />
          </div>
          
          <KpiSparkline 
            data={[10, 15, 12, 18, 22, 20, 25]} 
            height={40} 
            color="#16a34a"
            type="area"
          />
          
          <KpiDetails>
            <KpiDetail label="Mes anterior" value="$758K" />
            <KpiDetail label="Diferencia" value="+$92K" />
          </KpiDetails>
        </DashboardKpiCard>

        {/* Ejemplo 4: Card con badge y progress bar */}
        <DashboardKpiCard title="Ocupación">
          <div className="flex items-center justify-between mb-2">
            <KpiMetric value="75%" label="Ocupación" />
            <KpiBadge label="Excelente" variant="success" />
          </div>
          
          <KpiProgressBar 
            value={18} 
            max={24} 
            label="Propiedades ocupadas"
            showValues
            variant="success" 
          />
          
          <KpiDetails>
            <KpiDetail label="Disponibles" value={6} />
            <KpiDetail label="Mantenimiento" value={0} />
          </KpiDetails>
        </DashboardKpiCard>
      </section>

      {/* Cards especiales */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Ejemplo 5: Card con ícono */}
        <DashboardKpiCard title="Usuarios activos">
          <div className="flex items-center gap-4">
            <KpiIcon 
              icon={Users} 
              variant="info" 
              size="xl" 
              withBackground 
            />
            <div className="flex-1">
              <div className="text-3xl font-semibold">1,234</div>
              <p className="text-xs text-muted-foreground">+15% vs mes anterior</p>
            </div>
          </div>
        </DashboardKpiCard>

        {/* Ejemplo 6: Card minimalista */}
        <DashboardKpiCard title="% Retiro">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600">15.5%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ciclos cerrados sin alquilar
            </p>
          </div>
          
          <KpiDivider />
          
          <div className="space-y-1 text-xs pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ciclos cerrados:</span>
              <span className="font-medium">150</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sin alquilar:</span>
              <span className="font-medium text-red-600">23</span>
            </div>
          </div>
        </DashboardKpiCard>

        {/* Ejemplo 7: Card con múltiples barras de progreso */}
        <DashboardKpiCard title="Estado de propiedades">
          <div className="space-y-3">
            <KpiProgressBar 
              value={18} 
              max={24} 
              label="Alquiladas"
              showPercentage
              variant="success" 
              height="sm"
            />
            
            <KpiProgressBar 
              value={3} 
              max={24} 
              label="Disponibles"
              showPercentage
              variant="default" 
              height="sm"
            />
            
            <KpiProgressBar 
              value={2} 
              max={24} 
              label="En reparación"
              showPercentage
              variant="warning" 
              height="sm"
            />
            
            <KpiProgressBar 
              value={1} 
              max={24} 
              label="Retiradas"
              showPercentage
              variant="danger" 
              height="sm"
            />
          </div>
        </DashboardKpiCard>
      </section>

      {/* Card ancho completo */}
      <section>
        <DashboardKpiCard title="Resumen financiero mensual">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KpiIcon icon={DollarSign} variant="success" size="sm" />
                <span className="text-xs text-muted-foreground">Ingresos</span>
              </div>
              <div className="text-2xl font-semibold">$2,450,000</div>
              <KpiTrend value={8} percentage={8} direction="up" variant="positive" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KpiIcon icon={DollarSign} variant="danger" size="sm" />
                <span className="text-xs text-muted-foreground">Gastos</span>
              </div>
              <div className="text-2xl font-semibold">$890,000</div>
              <KpiTrend value={3} percentage={3} direction="down" variant="positive" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KpiIcon icon={DollarSign} variant="info" size="sm" />
                <span className="text-xs text-muted-foreground">Ganancia</span>
              </div>
              <div className="text-2xl font-semibold">$1,560,000</div>
              <KpiTrend value={12} percentage={12} direction="up" variant="positive" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Margen</span>
              </div>
              <div className="text-2xl font-semibold">63.7%</div>
              <KpiBadge label="Excelente" variant="success" />
            </div>
          </div>
          
          <KpiDivider />
          
          <KpiSparkline 
            data={[45, 52, 48, 61, 58, 67, 73, 68, 75, 82, 78, 85]} 
            height={60} 
            color="#3b82f6"
            type="area"
          />
        </DashboardKpiCard>
      </section>
    </div>
  );
}

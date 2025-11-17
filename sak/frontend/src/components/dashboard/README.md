# Dashboard KPI Components

Biblioteca de componentes reutilizables para crear dashboards con tarjetas KPI altamente configurables y consistentes.

## 📦 Componentes Disponibles

### Componentes Core

| Componente | Descripción |
|------------|-------------|
| `DashboardKpiCard` | Tarjeta principal contenedora |
| `DashboardRanking` | Lista ordenada con filtros y exportación |
| `RankingItem` | Item individual para rankings |
| `KpiMetric` | Métrica individual con valor grande |
| `KpiMetricsRow` | Row flex para métricas |
| `KpiDetails` | Grid para detalles secundarios |
| `KpiDetail` | Par label-value individual |
| `KpiAlert` | Mensaje de alerta con ícono |

### Componentes Adicionales

| Componente | Descripción |
|------------|-------------|
| `KpiTrend` | Indicador de tendencia con flecha |
| `KpiBadge` | Badge/Tag para etiquetas |
| `KpiProgressBar` | Barra de progreso |
| `KpiSparkline` | Mini gráfico de línea/área |
| `KpiDivider` | Separador visual |
| `KpiIcon` | Ícono con estilos predefinidos |

## 🚀 Uso Básico

### DashboardKpiCard

```tsx
import {
  DashboardKpiCard,
  KpiMetricsRow,
  KpiMetric,
  KpiDetails,
  KpiDetail,
} from "@/components/dashboard";

<DashboardKpiCard title="Vacancias totales">
  <KpiMetricsRow>
    <KpiMetric value={150} label="Vacancias" />
    <KpiMetric value={3450} label="Días" />
  </KpiMetricsRow>
  
  <KpiDetails>
    <KpiDetail label="Propiedades" value={45} />
    <KpiDetail label="Costo" value="$2,500,000" />
    <KpiDetail label="Promedio" value="23.5 días" />
  </KpiDetails>
</DashboardKpiCard>
```

## 📋 Ejemplos

### Ejemplo 1: Card con Alerta

```tsx
import { AlertCircle } from "lucide-react";

<DashboardKpiCard 
  title="Vacancias activas" 
  variant="danger"
  selected={selected}
  onSelect={() => setSelected(true)}
>
  <KpiMetricsRow>
    <KpiMetric value={25} label="Vacancias" />
    <KpiMetric value={890} label="Días" />
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
```

### Ejemplo 2: Card con Tendencia

```tsx
<DashboardKpiCard title="Ingresos mensuales" variant="success">
  <div className="flex items-center justify-between">
    <KpiMetric value="$850,000" label="Este mes" />
    <KpiTrend 
      value={12} 
      percentage={12} 
      direction="up" 
      variant="positive" 
    />
  </div>
  
  <KpiDetails>
    <KpiDetail label="Mes anterior" value="$758,000" />
    <KpiDetail label="Diferencia" value="+$92,000" />
  </KpiDetails>
</DashboardKpiCard>
```

### Ejemplo 3: Card con Barra de Progreso

```tsx
<DashboardKpiCard title="Ocupación de propiedades">
  <KpiMetric value="75%" label="Ocupación" />
  
  <KpiProgressBar 
    value={18} 
    max={24} 
    label="Propiedades ocupadas"
    showValues
    variant="success" 
  />
  
  <KpiDetails>
    <KpiDetail label="Disponibles" value={6} />
    <KpiDetail label="En mantenimiento" value={0} />
  </KpiDetails>
</DashboardKpiCard>
```

### Ejemplo 4: Card con Sparkline

```tsx
<DashboardKpiCard title="Tendencia semanal">
  <KpiMetricsRow>
    <KpiMetric value={342} label="Esta semana" />
    <KpiBadge label="↑ 12%" variant="success" />
  </KpiMetricsRow>
  
  <KpiSparkline 
    data={[10, 15, 12, 18, 22, 20, 25]} 
    height={40} 
    color="#16a34a"
    type="area"
  />
</DashboardKpiCard>
```

### Ejemplo 5: Layout Personalizado

```tsx
<DashboardKpiCard title="% Retiro">
  <div className="text-center">
    <div className="text-4xl font-bold text-red-600">15.5%</div>
    <p className="text-xs text-muted-foreground mt-1">
      Porcentaje de retiro
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
```

## 🎨 Variantes

### Colores

- `default` - Gris neutral
- `warning` - Amarillo/Ámbar
- `danger` - Rojo
- `success` - Verde
- `info` - Azul (solo en algunos componentes)

### Tamaños

Los componentes que soportan tamaños generalmente usan:
- `sm` - Pequeño
- `md` - Mediano (default)
- `lg` - Grande
- `xl` - Extra grande (algunos componentes)

## 💡 Consejos

1. **Consistencia**: Usa los componentes helper (`KpiMetric`, `KpiDetails`) para mantener consistencia
2. **Flexibilidad**: Puedes usar JSX personalizado dentro de `DashboardKpiCard` cuando lo necesites
3. **Accesibilidad**: Los cards con `onSelect` son navegables por teclado automáticamente
4. **Performance**: Los componentes son "use client" pero muy ligeros

## 🔧 TypeScript

Todos los componentes están completamente tipados con TypeScript. Los tipos están exportados junto con los componentes:

```tsx
import type { 
  DashboardKpiCardProps,
  KpiMetricProps,
  KpiAlertProps 
} from "@/components/dashboard";
```

## 📁 Estructura de Archivos

```
frontend/src/components/dashboard/
├── DashboardKpiCard.tsx      # Componente principal
├── KpiMetric.tsx              # Métrica individual
├── KpiMetricsRow.tsx          # Row de métricas
├── KpiDetails.tsx             # Grid de detalles
├── KpiDetail.tsx              # Par label-value
├── KpiAlert.tsx               # Alerta
├── KpiTrend.tsx               # Tendencia
├── KpiBadge.tsx               # Badge
├── KpiProgressBar.tsx         # Barra de progreso
├── KpiSparkline.tsx           # Mini gráfico
├── KpiDivider.tsx             # Separador
├── KpiIcon.tsx                # Ícono
├── index.ts                   # Re-exportaciones
└── README.md                  # Esta documentación
```

### DashboardRanking

```tsx
import { DashboardRanking, RankingItem } from "@/components/dashboard";

<DashboardRanking
  title="Top Vacancias"
  items={vacancies}
  loading={isLoading}
  renderItem={(item) => (
    <RankingItem
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="text-lg font-semibold">{item.days} días</div>
          <ActionsMenu />
        </div>
      }
    >
      <div className="space-y-1">
        <p className="font-semibold">{item.property}</p>
        <p className="text-xs text-muted-foreground">
          Ciclo #{item.id} - {item.status}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.owner} - {item.rooms} ambientes
        </p>
      </div>
    </RankingItem>
  )}
  filters={{
    primary: {
      label: "Estado",
      value: statusFilter,
      options: statusOptions,
      onChange: setStatusFilter
    },
    secondary: {
      label: "Período",
      value: periodFilter,
      options: periodOptions,
      onChange: setPeriodFilter
    }
  }}
  onExport={handleExport}
/>
```

## 🎯 Casos de Uso

- ✅ Dashboards de métricas
- ✅ Paneles de KPIs
- ✅ Tarjetas de resumen
- ✅ Indicadores de performance
- ✅ Métricas financieras
- ✅ Estadísticas de ocupación
- ✅ Reportes ejecutivos
- ✅ Rankings y listas ordenadas

## 🚦 Estado

✅ Componentes implementados y testeados
✅ TypeScript completo
✅ Documentación completa
✅ Listo para producción

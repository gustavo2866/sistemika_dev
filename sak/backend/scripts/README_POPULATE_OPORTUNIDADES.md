# Script de Población de Oportunidades CRM

Script para poblar la base de datos local de desarrollo con oportunidades de prueba para el dashboard CRM.

## 📋 Características

El script genera oportunidades con las siguientes características:

### 🏠 Distribución por Propiedades
- Genera múltiples oportunidades para cada propiedad en la base de datos
- Por defecto: 15 oportunidades por propiedad (configurable)

### 📅 Distribución Temporal
- Cubre un período de **2 años** (desde hace 730 días hasta hoy)
- Fechas de creación y estado distribuidas aleatoriamente
- Fechas de cierre estimadas entre 30 y 90 días desde la fecha de estado

### 📊 Estados del Pipeline
Distribución realista de estados:
- **30%** - Abierta (1-abierta)
- **20%** - Visita (2-visita)
- **15%** - Cotiza (3-cotiza)
- **10%** - Reserva (4-reserva)
- **15%** - Ganada (5-ganada)
- **10%** - Perdida (6-perdida)

### 💰 Montos Realistas
- **Ventas**: USD 80,000 - 500,000
- **Alquileres**: USD 800 - 3,500 (mensuales)
- **Otros**: USD 50,000 - 300,000

### 🎯 Probabilidades de Éxito
- Abierta: 10-30%
- Visita: 30-50%
- Cotiza: 50-70%
- Reserva: 70-90%
- Ganada: 100%
- Perdida: 0%

### 🏢 Actualización de Propiedades
El script actualiza automáticamente el estado de las propiedades según el estado de la oportunidad:
- **Ganada** → Propiedad pasa a **Alquilada** (4-alquilada)
- **Otros estados** → Propiedad pasa a **Disponible** (3-disponible)

### 📝 Datos Generados
- Descripciones realistas según el estado
- Asignación aleatoria de contactos y responsables
- Logs de cambio de estado
- Motivos de pérdida (cuando aplica)
- Moneda (preferentemente USD)

## 🚀 Uso

### Opción 1: PowerShell (Recomendado)
```powershell
.\cmd\populate_oportunidades_dev.ps1
```

### Opción 2: Python directo
```bash
cd backend
python scripts/populate_oportunidades_dev.py
```

## ⚙️ Configuración

### Variables de Entorno
El script lee la configuración de conexión desde:
- `DATABASE_URL` (variable de entorno)
- Por defecto: `postgresql://postgres:postgres@localhost:5432/crm_dev`

### Personalización
Para cambiar la cantidad de oportunidades por propiedad, edita la función `main()` en el script:

```python
populate_oportunidades(session, cantidad_por_propiedad=15)  # Cambiar el número aquí
```

## 📦 Requisitos Previos

### Datos Necesarios en la Base de Datos
El script requiere que existan previamente:
1. ✅ **Propiedades** (al menos 1)
2. ✅ **Usuarios** (al menos 1)
3. ✅ **Tipos de Operación** (al menos 1)
4. ⚠️ **Contactos** (se crean automáticamente si no existen)
5. ⚠️ **Motivos de Pérdida** (opcional)
6. ⚠️ **Monedas** (opcional, usa USD si existe)

### Migraciones Requeridas
Asegúrate de haber ejecutado:
- Migraciones de propiedades (012, 013)
- Migraciones de CRM (019, 020)
- Datos iniciales de usuarios

## 📊 Salida del Script

El script muestra:
```
🚀 Iniciando población de oportunidades...
📊 Datos disponibles:
  - 5 propiedades
  - 10 contactos
  - 3 usuarios
  - 4 tipos de operación
  - 5 motivos de pérdida

📝 Generando 15 oportunidades por propiedad...
📅 Periodo: 2023-11-25 a 2025-11-25

🏠 Propiedad: Casa Central
  📦 Actualizando propiedad 'Casa Central': 1-recibida → 4-alquilada
  ✅ 15 oportunidades generadas

...

✅ Total de oportunidades generadas: 75

📊 Resumen por estado:
  - 1-abierta: 22
  - 2-visita: 15
  - 3-cotiza: 11
  - 4-reserva: 8
  - 5-ganada: 12
  - 6-perdida: 7
```

## 🔍 Verificación

Para verificar que los datos se generaron correctamente:

```sql
-- Ver distribución por estado
SELECT estado, COUNT(*) 
FROM crm_oportunidades 
GROUP BY estado 
ORDER BY estado;

-- Ver oportunidades por propiedad
SELECT p.nombre, COUNT(o.id) 
FROM propiedades p 
LEFT JOIN crm_oportunidades o ON p.id = o.propiedad_id 
GROUP BY p.nombre;

-- Ver oportunidades por período (últimos 6 meses)
SELECT DATE_TRUNC('month', created_at) as mes, COUNT(*) 
FROM crm_oportunidades 
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY mes 
ORDER BY mes;
```

## ⚠️ Consideraciones

1. **No elimina datos existentes**: El script agrega oportunidades sin borrar las existentes
2. **Ejecutable múltiples veces**: Puedes ejecutarlo varias veces para generar más datos
3. **Solo para desarrollo**: Este script está diseñado para ambientes de desarrollo local
4. **Estados de propiedades**: Las propiedades cambiarán de estado según las oportunidades ganadas

## 🐛 Troubleshooting

### Error: "No hay propiedades en la base de datos"
```bash
# Ejecutar migraciones de propiedades
cd backend
python -m alembic upgrade head
```

### Error: "No hay usuarios en la base de datos"
```bash
# Ejecutar migración de datos iniciales
cd backend
python migrations/002_initial_dev_data.py
```

### Error de conexión a PostgreSQL
Verifica que:
- PostgreSQL esté corriendo
- La base de datos `crm_dev` exista
- Las credenciales sean correctas en `.env`

## 📝 Notas de Desarrollo

- Script ubicado en: `backend/scripts/populate_oportunidades_dev.py`
- Comando PowerShell en: `cmd/populate_oportunidades_dev.ps1`
- Usa SQLModel para interacción con la base de datos
- Genera timestamps en UTC
- Mantiene consistencia referencial con todas las tablas relacionadas

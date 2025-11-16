# 📝 Requerimientos - Completar Modelo Solicitudes

> **Referencia:** [README_BACKEND_PATTERNS.md](../README_BACKEND_PATTERNS_v1.md)  

> **Versión:** 1.0

---

## ⚠️ INSTRUCCIONES DE USO

1. **Copiar este template** para cada cambio significativo al backend
2. **Nombrar el archivo**: `SPEC_{fecha}_{feature}.md` (ej: `SPEC_20251110_agregar_campo_prioridad.md`)
3. **Completar todas las secciones** antes de comenzar desarrollo
4. **Revisar checklist** antes de considerar el cambio completo
5. **Consultar README_BACKEND_v1.md** para mantener patrones y convenciones

---

## 📋 METADATA DEL CAMBIO

| Campo | Valor |
|-------|-------|
| **Título** | `[Agregar entidad vacancia` |
| **Tipo** | `[x] Nueva Entidad  [x] Modificar Entidad  [ ] Nuevo Endpoint  [ ] Servicio  [ ] Refactor  [ ] Bugfix` |
| **Prioridad** | `[ ] Crítica  [ ] Alta  [x] Media  [ ] Baja` |
| **Fecha Creación** | `[2025-11-14]` |
| **Autor** | `[Gustavo]` |
| **Estimación** | `[2]` |
| **Estado** | `[ ] Planificado  [x] En Desarrollo  [ ] Testing  [ ] Completado  [ ] Revertido` |

---

## 1. DESCRIPCIÓN FUNCIONAL

### 1.1 Resumen Ejecutivo

> **Descripción en 2-3 líneas del cambio y su propósito de negocio.**

Se necesita controlar los tiempos de vacancia de cada propiedad. Es decir cuanto tiempo pasa desde que se recibe una propiedad hasta que se alquila.
El ciclo de vacancia se inicia cuando se recibe la propiedad por primera vez o cuando el contrato vigente se termina y el inquilino entrega la llave del mismo.
Una vez que se inicia el ciclo de vacancia la propiedad podría necesitar de un acondicionamiento antes de volver a ofrecerla en alquiler. Una vez que finaliza el acondicionamiento la propiedad queda disponible y se ofrece en alquiler. Esta se mantiene en estado dispobible hasta que se alquila nuevamente.


### 1.2 Justificación

**¿Por qué se necesita este cambio?**

### 1.2.1 Propiedades
Necesitamos agregar atributos a las propiedades para que nos facilite el control sobre las vacancias de las mismas. De cada propiedad necesitamos conocer:
- cantidad de ambientes
- metros cuadrados
- fecha de ingreso de la propiedad (original)
- valor del alquiler
- expensas
- vencimiento del contrato (si está alquilada)
- estado (1-recibida, 2-en reparacion, 3-disponible, 4-alquilada, 5-retirada).
- estado fecha (fecha en que se produce cada cambio de estado)
- estado comment

transiciones de estado
a) desde 1-recibida a cualquiera de las otras (2, 3. 4)
b) desde 2-reparacion solo a 3-disponible
c) desde 3-disponible a (4 o 3)
e) desde 4-alquilada a (1) Cuando el inquilino entrega la llave
f) cualquier estado (1 a 4) a 5-retirada

interaccion de estados de propiedad con vacancia

inicio de ciclo de vacancia
El inicio del ciclo de vacancia se produce cuando se da de alta la propiedad o cuando se cambia al estado 1-recibida

fin del ciclo de vacancia
cuando se cambia a estado 4-alquilada o 5-retirada

general
vacancia contará con un campo por cada estado. el cambio de estado de la propiedad generará una actualización del campo correspondiente de vacancia.


### 1.2.2 Vacancia
Se debe crear una nueva entidad relacionada a la propiedad. Debe contar con un campo fecha y comentario por cada estado descripto en el punto anterior.
Cuando se solicite un conjunto de registros de vacancias en funcion de algun filtro, la respuesta debe anejar a cada vacancia el registro extendido de propiedades para que el frontend tome los atributos de las mismas.

---

## 2. CONSULTAS COMPLEMENTARIAS

### 2.1 Precisiones sobre Fechas y Timestamps

**CONSULTA 1: Formato de Fechas en Vacancia**
> ¿Las fechas de cada estado en Vacancia deben almacenar solo la fecha (DATE) o fecha y hora completa (DATETIME/TIMESTAMP)?

**Contexto:** 
- **DATE** permite almacenar solo día (2024-11-14)
- **DATETIME** permite almacenar día y hora exacta (2024-11-14 15:30:45)

**Recomendación del sistema:**
- **DATETIME** para auditoría precisa y cálculo exacto de tiempos
- Permite saber la hora exacta de cada transición de estado
- Facilita calcular días con decimales si es necesario (ej: 2.5 días)

**Implicancias:**
- Mayor precisión en reportes de tiempos
- Útil para identificar patrones horarios
- Ocupa 8 bytes vs 4 bytes de DATE (diferencia mínima)

---

### 2.2 Reglas de Negocio sobre Múltiples Ciclos

**CONSULTA 2: Vacancias Simultáneas**
> ¿Es posible que una misma propiedad tenga más de un ciclo de vacancia activo (`ciclo_activo = true`) al mismo tiempo?

**Contexto:**
- Una propiedad en estado `disponible` tiene una vacancia activa
- ¿Puede iniciarse otro ciclo antes de cerrar el anterior?

**Recomendación del sistema:**
- **NO**, solo UN ciclo activo por propiedad
- Implementar constraint de base de datos: `UNIQUE(propiedad_id) WHERE ciclo_activo = true`
- Al pasar de `alquilada` a `recibida`, el sistema cierra automáticamente cualquier vacancia previa

**Implicancias:**
- Garantiza integridad de datos
- Simplifica reportes y métricas
- Evita confusiones en seguimiento

---

### 2.3 Flexibilidad en Transiciones de Estado

**CONSULTA 3: Transiciones Directas**
> ¿Se permiten "saltos" de estado? Por ejemplo:
> - ¿De `recibida` directamente a `alquilada` sin pasar por `disponible`?
> - ¿De `recibida` a `retirada` sin otros estados intermedios?

**Escenarios posibles:**
1. Propiedad se recibe y se alquila inmediatamente (sin reparaciones)
2. Propiedad se recibe pero el propietario decide retirarla antes de ofrecerla
3. Propiedad en reparación pero se decide retirarla del sistema

**Recomendación del sistema:**
- **SÍ**, permitir transiciones según matriz definida en especificación
- Desde `recibida`: puede ir a cualquier otro estado
- Desde `en_reparacion`: solo a `disponible` o `retirada`
- Desde `disponible`: solo a `alquilada` o `retirada`
- Desde `alquilada`: solo a `recibida` (nuevo ciclo) o `retirada`

**Beneficios:**
- Flexibilidad para casos excepcionales
- No fuerza flujo artificial si no es necesario
- Sistema más realista

---

### 2.4 Edición de Datos Históricos

**CONSULTA 4: Modificación de Vacancias Cerradas**
> ¿Se pueden editar/eliminar registros de vacancia una vez que el ciclo está cerrado (`ciclo_activo = false`)?

**Contexto:**
- Vacancia cerrada contiene métricas calculadas (días_reparacion, días_totales, etc.)
- Modificarla podría alterar reportes históricos

**Opciones:**
1. **Solo lectura** - No permitir edición de vacancias cerradas
2. **Edición limitada** - Permitir solo cambios en comentarios
3. **Edición completa** - Permitir cualquier cambio con auditoría
4. **Soft delete** - Permitir "eliminar" pero mantener en BD

**Recomendación del sistema:**
- **Solo lectura** para vacancias con `ciclo_activo = false`
- Validar en endpoint PUT: rechazar cambios si ciclo cerrado
- Si se necesita corrección: sistema de "correcciones" con justificación

**Implicancias:**
- Garantiza integridad de reportes históricos
- Evita manipulación de métricas
- Mantiene auditoría confiable

---

### 2.5 Cálculo de Días

**CONSULTA 5: Días Calendario vs Días Hábiles**
> ¿El cálculo de días en métricas de vacancia debe usar:
> - **Días calendario** (incluyendo fines de semana y feriados)
> - **Días hábiles** (solo días laborables)

**Contexto:**
- Días calendario: más simple, cuenta todos los días
- Días hábiles: más realista para estimar tiempos de trabajo

**Ejemplo:**
- Propiedad recibida: Viernes 10/11
- Propiedad disponible: Lunes 20/11
- Días calendario: 10 días
- Días hábiles: 6 días (excluye 2 fines de semana)

**Recomendación del sistema:**
- **FASE 1 (MVP):** Usar días calendario
  - Más simple de implementar
  - No requiere calendario de feriados
  - Suficiente para métricas iniciales
  
- **FASE 2 (Futuro):** Agregar campo adicional `dias_habiles`
  - Requiere integrar calendario de feriados
  - Útil para planificación de recursos
  - Comparar métricas entre ambos tipos

**Complejidad:**
- Días calendario: función simple de fecha
- Días hábiles: requiere tabla/API de feriados nacionales

---

### 2.6 Validaciones de Consistencia

**CONSULTA 6: Validación de Fechas de Ingreso**
> ¿La `fecha_ingreso` de la propiedad puede ser posterior a la `fecha_recibida` de la primera vacancia?

**Casos posibles:**
1. `fecha_ingreso = fecha_recibida` (primera vacancia)
2. `fecha_ingreso < fecha_recibida` (vacancia posterior)
3. `fecha_ingreso > fecha_recibida` (¿inconsistencia?)

**Recomendación del sistema:**
- `fecha_ingreso` debe ser <= `fecha_recibida` de cualquier vacancia
- Validar al crear vacancia: `fecha_recibida >= propiedad.fecha_ingreso`
- `fecha_ingreso` nunca debe ser futura

**Validación adicional:**
- Al crear/editar propiedad: `fecha_ingreso <= fecha_actual`
- Si ya hay vacancias: `fecha_ingreso <= min(vacancias.fecha_recibida)`

---

### 2.7 Estados Actuales en Base de Datos

**CONSULTA 7: Migración de Estados Existentes**
> Actualmente las propiedades pueden tener estados como: `activa`, `mantenimiento`, `inactiva`, etc.
> ¿Cómo deben migrarse al nuevo esquema?

**Mapeo propuesto:**

| Estado Actual | Estado Nuevo | ¿Crear Vacancia? |
|---------------|--------------|------------------|
| activa | disponible | Sí (ciclo activo) |
| mantenimiento | en_reparacion | Sí (ciclo activo) |
| alquilada | alquilada | No (ciclo cerrado) |
| disponible | disponible | Sí (ciclo activo) |
| inactiva | retirada | No (ciclo cerrado) |
| baja | retirada | No (ciclo cerrado) |

**Proceso de migración:**
1. Aplicar migración de schema (agregar columnas)
2. Ejecutar script de mapeo de estados
3. Crear vacancias para estados no finales
4. Validar que no queden estados antiguos

**Pregunta:** ¿Existen otros estados actuales no listados?

---

### 2.8 Reglas de Negocio para Vencimiento de Contrato

**CONSULTA 8: Obligatoriedad de Vencimiento de Contrato**
> Cuando una propiedad pasa a estado `alquilada`:
> - ¿Es OBLIGATORIO especificar `vencimiento_contrato`?
> - ¿Qué pasa si el contrato es "por tiempo indeterminado"?

**Opciones:**
1. **Obligatorio siempre** - Sistema rechaza si no se provee
2. **Obligatorio con excepción** - Permitir NULL para contratos sin plazo
3. **Opcional** - No validar, dejar a criterio del usuario

**Recomendación del sistema:**
- **Obligatorio con excepción**: requerir fecha excepto si se marca explícitamente como "sin plazo"
- Agregar campo boolean `contrato_sin_plazo` (opcional)
- Validar que vencimiento sea >= fecha_actual (al crear/editar)

**Notificaciones sugeridas:**
- Alertar 30 días antes del vencimiento
- Recordatorio al vencer para cambiar estado

---

### 2.9 Relación con Otras Entidades

**CONSULTA 9: Vinculación con Facturas y Gastos**
> ¿Se necesita vincular los gastos de reparación de una vacancia con facturas específicas?

**Casos de uso:**
- Registrar cuánto se gastó en acondicionar la propiedad durante vacancia
- Calcular ROI de inversión en reparaciones
- Imputar gastos a propiedades específicas

**Opciones:**
1. **Fase MVP:** No vincular, solo registrar comentarios
2. **Fase 2:** Agregar `costo_reparacion` calculado desde facturas relacionadas
3. **Fase 3:** Vincular facturas específicas a vacancia_id

**Recomendación:**
- MVP: no implementar vinculación
- Futuro: agregar relación Vacancia → Facturas
- Usar campo `propiedad_id` existente en Facturas como base

---

### 2.10 Notificaciones y Alertas

**CONSULTA 10: Alertas Automáticas**
> ¿Se necesita que el sistema envíe notificaciones/alertas sobre vacancias?

**Escenarios:**
1. Propiedad lleva más de 30 días en estado `disponible` sin alquilar
2. Propiedad en `en_reparacion` más de 15 días
3. Contrato próximo a vencer (30 días)
4. Nueva vacancia creada (notificar a responsable)

**Recomendación:**
- **Fase MVP:** Dashboard con indicadores visuales (sin notificaciones push)
- **Fase 2:** Sistema de alertas por email/notificación
- **Fase 3:** Configuración personalizada de umbrales

No en esta versión. Alertas se muestran por dashboard.

**Implementación sugerida:**
- Endpoint `GET /api/vacancias/alertas` que retorne vacancias que requieren atención
- Frontend puede mostrar badge con cantidad de alertas

---

### 2.11 Reportes y Métricas Adicionales

**CONSULTA 11: Métricas y KPIs Requeridos**
> ¿Qué reportes/métricas se necesitan visualizar sobre vacancias?

**Métricas básicas (incluidas en spec):**
- Días en cada estado por ciclo
- Promedio de días totales de vacancia
- Cantidad de ciclos por propiedad

**Métricas adicionales sugeridas:**
1. **Por tipo de propiedad:** Promedio de vacancia para Departamentos vs Locales
2. **Por ubicación:** Si se agrega campo `ubicacion` a propiedades
3. **Tendencias temporales:** Vacancia por mes/trimestre
4. **Rotación:** Propiedades con mayor frecuencia de ciclos
5. **Ingresos perdidos:** `dias_disponible * valor_alquiler / 30`

**Pregunta:** ¿Hay métricas específicas prioritarias?

todas las sugerenicas serán necesarias. se resuelven a nivel reportes.
---

### 2.12 Permisos y Seguridad

**CONSULTA 12: Control de Acceso**
> ¿Hay restricciones de permisos para cambio de estados y edición de vacancias?

**Escenarios:**
1. **Todos los usuarios:** pueden ver vacancias
2. **Solo administradores:** pueden cambiar estado de propiedades
3. **Roles específicos:** solo "gestores de propiedades" pueden editar

**Recomendación:**
- Implementar validación de roles en endpoint `cambiar-estado`
- Usar decorador `@requires_role(['admin', 'gestor_propiedades'])`
- Logs de auditoría: quién cambió estado y cuándo

no aplica en esta instancia

**Pregunta:** ¿Existen roles definidos en el sistema actual?

NO
---


## 3. RESUMEN DE DECISIONES PENDIENTES

| # | Tema | Opciones | Impacto |
|---|------|----------|---------|
| 1 | Formato fechas | DATE vs DATETIME | Bajo |
| 2 | Vacancias múltiples | Permitir o no | Medio |
| 3 | Saltos de estado | Flexible vs estricto | Medio |
| 4 | Edición histórico | Solo lectura vs editable | Alto |
| 5 | Tipo de días | Calendario vs hábiles | Bajo (MVP) / Alto (futuro) |
| 6 | Vencimiento obligatorio | Siempre vs excepciones | Bajo |
| 7 | Vinculación facturas | Ahora vs futuro | Bajo (MVP) |
| 8 | Alertas | Implementar o no | Medio |
| 9 | Métricas adicionales | Cuáles priorizar | Medio |
| 10 | Permisos | Roles a validar | Alto |

---

## 4. PRÓXIMOS PASOS

Una vez resueltas las consultas complementarias:

1. **Actualizar especificación técnica** con decisiones tomadas ✅
2. **Ajustar modelos de datos** según necesidades confirmadas ✅
3. **Implementar backend** siguiendo spec actualizada
4. **Crear tests** cubriendo casos de borde identificados
5. **Documentar** decisiones de diseño en README

---

## 5. DECISIONES TOMADAS (2025-11-14)

### 5.1 Estados con Prefijos Numéricos
**Decisión:** Los estados llevan prefijo numérico para indicar secuencia:
- `1-recibida` (inicio de ciclo)
- `2-en_reparacion`
- `3-disponible`
- `4-alquilada` (cierre de ciclo)
- `5-retirada` (cierre de ciclo)

**Razón:** Facilita inferencia de secuencia y ordenamiento en interfaces.

### 5.2 Métricas Calculadas Dinámicamente
**Decisión:** Las métricas de días se calculan mediante **properties del modelo** en tiempo real:
- Si `ciclo_activo = true`: usar `fecha_actual` como referencia
- Si `ciclo_activo = false`: usar fecha de cierre del ciclo

**Implementación:**
```python
@property
def dias_disponible_calculado(self) -> Optional[int]:
    if not self.fecha_disponible:
        return None
    fecha_fin = self.fecha_alquilada or (datetime.utcnow() if self.ciclo_activo else None)
    if not fecha_fin:
        return None
    return (fecha_fin - self.fecha_disponible).days
```

**Razón:** Evita almacenar datos desactualizados mientras el ciclo está activo.

### 5.3 Inicialización de Propiedades
**Decisión:** TODAS las propiedades se colocan inicialmente en estado `1-recibida` con vacancia activa.

**Proceso:**
1. Migración de schema
2. Script coloca todas las propiedades en `1-recibida`
3. Script crea vacancia activa para cada propiedad
4. Usuario actualiza estados posteriormente usando endpoint `cambiar-estado`

**Razón:** Simplifica migración y garantiza consistencia inicial.

### 5.4 Reutilización de CRUD Genérico
**Decisión:** El endpoint especializado `cambiar-estado` REUTILIZA métodos del CRUD genérico:
```python
propiedad_crud = GenericCRUD(Propiedad)
vacancia_crud = GenericCRUD(Vacancia)

# Usar en endpoint
propiedad = propiedad_crud.get(session, id)
vacancia = vacancia_crud.update(session, vacancia.id, update_data)
```

**Razón:** Evita duplicación de lógica (validaciones, soft-delete, auditoría).

### 5.5 Reportes mediante GET Estándar
**Decisión:** Los reportes de métricas se cubren con GET estándar del CRUD + filtros:
```bash
GET /api/vacancias?expand=propiedad&ciclo_activo__eq=true
```

Frontend calcula agregaciones (promedios, totales).

**Excepción:** Endpoint de métricas agregadas solo si se necesitan cálculos SQL complejos (GROUP BY).

**Razón:** Mayor flexibilidad y menor complejidad en backend MVP.

---

**Documento actualizado:** 2025-11-14  
**Estado:** Decisiones de arquitectura confirmadas  
**Siguiente paso:** Implementación según spec actualizada


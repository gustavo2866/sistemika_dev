# Resumen de Verificación - Dashboard de Vacancias
**Fecha:** 16 de noviembre de 2025
**Endpoint:** `/api/dashboard/vacancias`

---

## Estado General
✅ **Estructura del código:** Correcta
✅ **Router registrado:** Sí (main.py línea 105)
✅ **Modelos:** Correctos
❌ **Funcionalidad:** No operativa

---

## Datos en Base de Datos
- **Total propiedades:** 25
- **Total vacancias:** 41
- **Rango de fechas:** 2023-12-24 a 2029-02-10
- **Vacancias activas:** ~16 (ciclo_activo=True)
- **Vacancias cerradas:** ~25 (ciclo_activo=False)

---

## Problemas Encontrados

### ❌ ISSUE #1: Query retorna 0 items cuando debería retornar 30
**Severidad:** CRÍTICA
**Ubicación:** `backend/app/services/vacancia_dashboard.py` línea 137-150

**Descripción:**
El endpoint siempre retorna KPIs en 0 porque `fetch_vacancias_for_dashboard()` retorna una lista vacía.

**Diagnóstico:**
1. La base de datos tiene 41 vacancias
2. El query trae las 41 vacancias correctamente
3. `_calculate_for_vacancia()` funciona correctamente cuando se llama directamente
4. Dentro de `fetch_vacancias_for_dashboard()`, todas las excepciones se omiten silenciosamente
5. El try-except captura errores de tipo `AttributeError: id` en todas las vacancias

**Causa raíz:**
Las vacancias retornadas por `session.exec(query).all()` no son instancias de `Vacancia`, sino `Row` objetos de SQLAlchemy que no tienen atributos directos. Esto causa que `_calculate_for_vacancia()` falle al intentar acceder a `v.fecha_recibida`, `v.fecha_alquilada`, etc.

**Evidencia:**
```
Traceback (most recent call last):
  File "lib\\sqlalchemy\\cyextension\\resultproxy.pyx", line 66
  File "lib\\sqlalchemy\\cyextension\\resultproxy.pyx", line 63
  File ".../sqlalchemy/engine/result.py", line 201, in _key_not_found
    raise AttributeError(ke.args[0]) from ke
AttributeError: id
```

**Solución propuesta:**
Opciones:
1. Cambiar el query para asegurar que retorne instancias de Vacancia
2. Revisar si hay un problema con el join cuando NO hay filtros
3. Verificar la configuración de selectinload
4. Agregar logging temporal para identificar exactamente cuándo ocurre el error

**Impacto:**
- Dashboard completamente no funcional
- Endpoint retorna datos en 0 para todos los KPIs
- Frontend no puede mostrar información de vacancia

---

### ⚠️ ISSUE #2: 11 vacancias con fechas futuras en datos de prueba
**Severidad:** BAJA (comportamiento esperado)
**Ubicación:** Datos de prueba

**Descripción:**
11 de las 41 vacancias tienen `fecha_recibida` posterior a 2025-11-16 (hoy), por lo que se excluyen correctamente del cálculo.

**Vacancias excluidas:** #7, #12, #14, #19, #21, #22, #25, #33, #35, #40

**Ejemplo:**
- Vacancia #7: fecha_recibida = 2026-10-17 (futuro)
- Condición: `fecha_recibida > end` = True
- Resultado: Excluida correctamente

**Solución:**
No es un bug. Es comportamiento correcto del filtro de rango de fechas. Los datos de prueba incluyen fechas en el futuro intencionalmente.

---

### ✅ VERIFICACIÓN #3: Vacancias activas sin fechas completas
**Severidad:** N/A (comportamiento correcto)
**Ubicación:** Datos + lógica de cálculo

**Descripción:**
Las vacancias activas (`ciclo_activo=True`) no tienen `fecha_alquilada` ni `fecha_retirada` porque el ciclo aún no terminó.

**Manejo en código:**
```python
cierre_dt = v.fecha_alquilada or v.fecha_retirada
cierre = _parse_date(cierre_dt)  # Puede ser None
fin_real = cierre or today  # Usa today si no hay cierre
```

El código maneja correctamente este caso usando `today` como fecha de fin para ciclos activos.

**Verificación:**
- Vacancia #2: activa, fecha_recibida=2025-11-14, dias_totales=2 ✅
- Vacancia #3: activa, fecha_recibida=2025-11-14, dias_totales=2 ✅
- Vacancia #5: activa, fecha_recibida=2025-11-14, dias_totales=2 ✅

---

## Tests Realizados

### Test 1: Endpoint principal sin filtros
**Rango:** 2023-01-01 a 2025-11-16
**Resultado:** 0 items (❌ esperado: ~30)
**KPIs:** Todos en 0
**Buckets:** 0
**Estados:** Todos en 0

### Test 2: Endpoint detalle con paginación
**Resultado:** 0 items (❌ esperado: ~30)
**Paginación:** Estructura correcta pero vacía

### Test 3: Filtros
**Filtro por estado:** Retorna 0 (❌)
**Filtro por ambientes:** Retorna 0 (❌)

### Test 4: Cálculo directo
**Método:** Llamada directa a `_calculate_for_vacancia()`
**Resultado:** ✅ Funciona correctamente
**Items calculados:** 30 de 41 (11 excluidas por fecha futura)

### Test 5: Query directo
**Query básico:** ✅ Retorna 41 vacancias
**Query con selectinload:** ✅ Retorna 41 vacancias
**Relación propiedad:** ✅ Carga correctamente

### Test 6: Servicio completo
**`fetch_vacancias_for_dashboard()`:** ❌ Retorna 0 items
**Causa:** Try-except omite todos los errores silenciosamente

---

## Resumen Ejecutivo

### Estado Actual
❌ El dashboard NO está funcional debido a un problema crítico en `fetch_vacancias_for_dashboard()`.

### Problema Principal
Todas las vacancias lanzan `AttributeError` al intentar acceder a sus atributos, lo que indica que el query retorna objetos `Row` en lugar de instancias de `Vacancia`.

### Próximos Pasos
1. **URGENTE:** Corregir el query en `fetch_vacancias_for_dashboard()` para asegurar que retorne instancias de `Vacancia`
2. Mejorar el manejo de errores (logging en lugar de omitir silenciosamente)
3. Re-ejecutar tests de verificación
4. Validar cálculos con datos conocidos

### Componentes Verificados ✅
- Modelos (Vacancia, Propiedad, EstadoPropiedad)
- Router registrado en main.py
- Estructura de endpoints
- Lógica de cálculo (`_calculate_for_vacancia`)
- Manejo de vacancias activas
- Manejo de fechas futuras
- Integridad referencial (todas las vacancias tienen propiedad válida)

### Componentes con Problemas ❌
- `fetch_vacancias_for_dashboard()` - Query retorna tipo incorrecto
- Try-except silencioso - Oculta el problema real
- Endpoint retorna 0 items siempre

---

**Nota:** Este es un reporte de verificación solamente. No se realizaron correcciones al código (según instrucciones del usuario).

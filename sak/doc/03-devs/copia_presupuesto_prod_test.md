# Copiar importes presupuestados de producción a test

Usar `backend/scripts/sync_erp_budget_values_prod_to_test.py` para copiar solo
`ingres` y `egreso` de los meses indicados. Producción se consulta en una
transacción de solo lectura desde `.env.production.local`; test usa `.env`.

Desde `backend`:

```powershell
python scripts/sync_erp_budget_values_prod_to_test.py --year 2026 --months 11 12 --dry-run
python scripts/sync_erp_budget_values_prod_to_test.py --year 2026 --months 11 12 --apply
```

Sin `--apply` únicamente simula. No usa DELETE ni TRUNCATE, ni modifica reales,
datos de obreros, referencias o meses fuera de la selección. Actualiza por
mes/proyecto/cuenta y crea las filas presupuestadas faltantes con reales cero.
Los importes de test sin correspondencia activa en producción quedan en cero,
conservando la fila y sus reales. Comprueba la identidad de proyectos y cuentas,
y rechaza presupuestos duplicados o meses sin filas activas en producción.

Antes de aplicar guarda las filas originales y el plan en `backend/tmp`.
Los cambios en test se confirman en una sola transacción después de verificar
los totales por mes y la conservación de los demás datos de filas existentes.
La repetición de la copia no genera cambios si los importes ya coinciden.

El script anterior `sync_erp_budget_prod_to_test.py` reemplaza tablas completas
y no corresponde a esta copia parcial.

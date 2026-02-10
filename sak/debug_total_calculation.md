# Debug: Total Calculation Issue

## Problem Analysis

The user reports that the "total" field is not being updated when adding lines to the detail in the poOrders/form.

## Key Components Involved

1. **TotalCompute Component** (`form_order/form/total_compute.tsx`)
   - Uses `useWatch({ name: "detalles" })` to observe changes in details array
   - Calculates total using `computePoOrderTotal` function
   - Sets the total value using `setValue("total", total)`

2. **CalculatedImporte Component** (`form_order/form/calculated_importe.tsx`)
   - Uses `useWatch` for "cantidad" and "precio" fields
   - Calculates importe using `computeDetalleImporte` function
   - Sets the importe value using `setValue("importe", importe)`

3. **computePoOrderTotal Function** (`model.ts`)
   - Sums all `importe` values from detalles array
   - Returns `Number(total.toFixed(2))`

## Potential Issues

### Issue 1: useWatch Dependency Array
The `TotalCompute` component watches the entire `detalles` array, but `useWatch` might not trigger when:
- New items are added to the array
- Nested properties (like `importe`) change within array items

### Issue 2: Timing Issues
There might be a race condition where:
1. A new detail line is added
2. `TotalCompute` recalculates before the `CalculatedImporte` has set the `importe` value
3. The total calculation uses the old/empty importe values

### Issue 3: Deep Watch Issue
`useWatch({ name: "detalles" })` might not properly detect changes to nested fields within the array items.

## Recommended Solutions

### Solution 1: Watch Individual Importe Fields
Instead of watching the entire `detalles` array, watch individual `importe` fields:

```tsx
// In TotalCompute component
const detallesLength = useWatch({ name: `${detailsSource}.length` });
const importeFields = Array.from({ length: detallesLength || 0 }, (_, i) => 
  useWatch({ name: `${detailsSource}.${i}.importe` })
);
```

### Solution 2: Force Deep Watch
Use a custom effect that manually stringifies the detalles to detect deep changes:

```tsx
const detalles = useWatch({ name: detailsSource });
const detallesJson = JSON.stringify(detalles);
const total = useMemo(() => computeTotal(detalles ?? []), [detallesJson, computeTotal]);
```

### Solution 3: Add Explicit Dependencies
Make sure the total calculation depends on all relevant fields:

```tsx
const detalles = useWatch({ name: detailsSource });
const detallesImportes = detalles?.map(d => d.importe) || [];
const total = useMemo(() => computeTotal(detalles ?? []), [detalles, detallesImportes, computeTotal]);
```

## Next Steps

1. Test the current implementation to confirm the issue
2. Implement one of the recommended solutions
3. Test with adding/removing lines and changing quantities/prices
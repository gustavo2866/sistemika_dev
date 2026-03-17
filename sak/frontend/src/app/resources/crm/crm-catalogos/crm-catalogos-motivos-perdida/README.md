# Patron del resource `crm-catalogos-motivos-perdida`

Este resource aplica el mismo patron de catalogo simple usado en
`crm-catalogos-condiciones-pago`.

## Estructura del resource

- `list.tsx`: listado con filtros compactos y tabla responsive.
- `form.tsx`: formulario compartido entre alta y edicion.
- `create.tsx`: wrapper de alta.
- `edit.tsx`: wrapper de edicion.
- `show.tsx`: detalle solo lectura.
- `model.ts`: schema, defaults, tipos y helpers del dominio.
- `index.ts`: exports explicitos del modulo.

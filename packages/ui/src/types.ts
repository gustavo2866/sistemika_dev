import * as React from "react"

/**
 * Tipo agnóstico para un componente de enlace.
 * Puede ser reemplazado por `next/link`, `react-router-dom/Link`, etc.
 */
export type LinkComponent = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<React.AnchorHTMLAttributes<HTMLAnchorElement>> &
  React.RefAttributes<HTMLAnchorElement>
>

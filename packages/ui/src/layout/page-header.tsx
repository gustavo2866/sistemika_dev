"use client"

import * as React from "react"
import { Separator } from "../components/separator"

export function PageHeader({
  leading,     // izquierda (ej. SidebarTrigger)
  children,    // centro (ej. BreadcrumbCore)
  trailing,    // derecha (ej. Search, ThemeToggle, UserMenu)
  className = "",
}: {
  leading?: React.ReactNode
  children?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <header className={`bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4 ${className}`}>
      {leading}
      {leading ? <Separator orientation="vertical" className="mr-2 h-4" /> : null}
      <div className="flex-1 min-w-0">{children}</div>
      {trailing}
    </header>
  )
}

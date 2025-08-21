"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "../components/sidebar"

export function SidebarShell({
  sidebar,
  header,
  children,
  footer,
}: {
  sidebar: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset>
        {header}
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
        {footer}
      </SidebarInset>
    </SidebarProvider>
  )
}

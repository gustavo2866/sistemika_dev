"use client"

import * as React from "react"
import type { Category } from "../types/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../components/sidebar"
import { ChevronsUpDown, Check, PanelsTopLeft } from "lucide-react"

export function CategorySwitch({
  categories,
  value,
  onChange,
  label = "Category",
}: {
  categories: Category[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  const current = categories.find(c => c.id === value) ?? categories[0]
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <PanelsTopLeft className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">{label}</span>
                <span>{current?.label ?? "All"}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
            {categories.map(c => (
              <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)}>
                {c.label} {c.id === value && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

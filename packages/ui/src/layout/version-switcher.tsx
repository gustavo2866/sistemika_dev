"use client"

import * as React from "react"
import { Check, ChevronsUpDown, GalleryVerticalEnd } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../components/sidebar"

export function VersionSwitcher({
  versions,
  defaultVersion,
  label = "Version",
  onChange,
}: {
  versions: string[]
  defaultVersion: string
  label?: string
  onChange?: (v: string) => void
}) {
  const [selected, setSelected] = React.useState(defaultVersion)
  const pick = (v: string) => { setSelected(v); onChange?.(v) }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">{label}</span>
                <span>v{selected}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
            {versions.map(v => (
              <DropdownMenuItem key={v} onSelect={() => pick(v)}>
                v{v} {v === selected && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

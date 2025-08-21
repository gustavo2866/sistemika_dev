"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import type { SidebarData } from "../types/navigation"
import type { LinkComponent } from "./link-slot"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail,
} from "../components/sidebar"

import { VersionSwitcher } from "./version-switcher"

export function AppSidebarCore({
  data,
  onVersionChange,
  Link = ({ children, ...p }) => <a {...p}>{children}</a>,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  data: SidebarData
  onVersionChange?: (v: string) => void
  Link?: LinkComponent
}) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.defaultVersion}
          onChange={onVersionChange}
        />
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {data.navMain.map((group) => (
          <Collapsible key={group.title} title={group.title} defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  {group.title}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>

              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={item.isActive}>
                          <Link href={item.href}>{item.title}</Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}

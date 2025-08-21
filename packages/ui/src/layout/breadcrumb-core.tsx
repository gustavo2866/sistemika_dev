"use client"

import * as React from "react"
import type { LinkComponent } from "./link-slot"
import type { Crumb } from "../types/navigation"

import {
  Breadcrumb as UIBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink as UIBreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/breadcrumb"

export function BreadcrumbCore({
  items,
  Link = ({ children, ...p }) => <a {...p}>{children}</a>,
}: {
  items: Crumb[]
  Link?: LinkComponent
}) {
  return (
    <UIBreadcrumb>
      <BreadcrumbList>
        {items.map((c, i) => {
          const isLast = i === items.length - 1
          if ("href" in c) {
            return (
              <React.Fragment key={`${c.href}-${i}`}>
                <BreadcrumbItem className="hidden md:block">
                  <UIBreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </UIBreadcrumbLink>
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
              </React.Fragment>
            )
          }
          return (
            <BreadcrumbItem key={`${c.label}-${i}`}>
              <BreadcrumbPage>{c.label}</BreadcrumbPage>
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </UIBreadcrumb>
  )
}

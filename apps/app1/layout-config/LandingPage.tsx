// apps/app1/components/LandingPage.tsx
"use client";

import * as React from "react";
import { ThemeToggle } from "@workspace/ui/components/theme-toggle";
import {
  SidebarShell,
  PageHeader,
  AppSidebarCore,
  BreadcrumbCore,
  Footer,
  SidebarTrigger,
  type SidebarData,
  type Crumb,
} from "@workspace/ui";
import { NextLinkAdapter } from "./NextLinkAdapter";
import SearchFormNext from "./SearchFormNext";

type LandingPageProps = {
  sidebarData: SidebarData;
  crumbs: Crumb[];                          // ← requerido
  trailingHeader?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  showThemeToggle?: boolean;
  children?: React.ReactNode;
};

export default function LandingPage({
  sidebarData,
  crumbs,
  trailingHeader,
  footerLeft = "© Your Company",
  footerRight = <span>v1.0</span>,
  showThemeToggle = true,
  children,
}: LandingPageProps) {
  return (
    <SidebarShell
      // 👇 Aca se usa el adapter para que el sidebar navegue con next/link
      sidebar={<AppSidebarCore data={sidebarData} Link={NextLinkAdapter} />}
      header={
        <PageHeader
          leading={<SidebarTrigger className="-ml-1" />}
          trailing={
            trailingHeader ?? (
              <div className="flex items-center gap-2">
                <SearchFormNext />
                {showThemeToggle && <ThemeToggle />}
              </div>
            )
          }
        >
          {/* 👇 Y acá para los links del breadcrumb */}
          <BreadcrumbCore items={crumbs} Link={NextLinkAdapter} />
        </PageHeader>
      }
      footer={<Footer left={footerLeft} right={footerRight} />}
    >
      {children ?? (
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          Contenido principal
        </div>
      )}
    </SidebarShell>
  );
}

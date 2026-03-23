"use client";

import { ArrowLeft, Handshake, RefreshCcw } from "lucide-react";
import { ResourceTitle } from "@/components/forms/form_order";
import type { DashboardHeaderViewModel } from "./use-dashboard-header";

export const DashboardHeader = ({
  title,
  dashboardLoading,
  loadingMessage,
  onMobileBack,
}: DashboardHeaderViewModel) => (
  <>
    <div className="flex items-center justify-between px-3 sm:hidden">
      <button
        type="button"
        onClick={onMobileBack}
        aria-label="Volver"
        className="flex items-center gap-1 text-primary transition-opacity active:opacity-60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">Volver</span>
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 text-[14px] font-semibold tracking-tight text-foreground">
        {title}
      </span>
      <span className="h-8 w-8" aria-hidden="true" />
    </div>

    <div className="relative hidden items-start justify-between gap-1.5 sm:flex sm:gap-3">
      <div className="min-w-0">
        <ResourceTitle
          icon={Handshake}
          text={title}
          className="text-[1.15rem] sm:text-lg md:text-[1.75rem]"
          iconWrapperClassName="h-8 w-8 rounded-xl bg-primary/10 text-primary shadow-none sm:h-10 sm:w-10"
          iconClassName="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5"
        />
      </div>
      {dashboardLoading ? (
        <div className="pointer-events-none absolute right-0 top-1 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/95 px-2 py-0.5 text-[10px] font-medium text-blue-700 shadow-sm">
          <RefreshCcw className="h-3 w-3 animate-spin" />
          {loadingMessage}
        </div>
      ) : null}
    </div>
  </>
);

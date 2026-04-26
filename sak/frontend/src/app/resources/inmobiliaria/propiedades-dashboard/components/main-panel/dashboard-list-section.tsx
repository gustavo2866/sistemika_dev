"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
} from "../../model";
import type {
  DashboardMainPanelViewModel,
} from "./use-dashboard-main-panel";
import {
  PropiedadesDetailTable,
  buildPropiedadesDetailTitle,
} from "./propiedades-detail-table";

type DashboardListSectionProps = Pick<
  DashboardMainPanelViewModel,
  "detailItems" | "detailLoading" | "hasMoreDetail" | "onLoadMore"
> & {
  expanded: boolean;
  onToggleExpanded: () => void;
  title: string;
  emptyMessage: string;
  showContratoColumn: boolean;
  valueColumnLabel: string;
};

export const DashboardListSection = ({
  detailItems,
  detailLoading,
  hasMoreDetail,
  onLoadMore,
  expanded,
  onToggleExpanded,
  title,
  emptyMessage,
  showContratoColumn,
  valueColumnLabel,
}: DashboardListSectionProps) => {
  const detailViewportRef = useRef<HTMLDivElement | null>(null);
  const detailLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const isInitialDetailLoading = detailLoading && detailItems.length === 0;

  useEffect(() => {
    if (!detailLoading) {
      loadingMoreRef.current = false;
    }
  }, [detailLoading]);

  useEffect(() => {
    const root = detailViewportRef.current;
    const target = detailLoadSentinelRef.current;

    if (!expanded || !root || !target || !hasMoreDetail) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || detailLoading || loadingMoreRef.current) {
          return;
        }
        loadingMoreRef.current = true;
        onLoadMore();
      },
      {
        root,
        rootMargin: "0px 0px 72px 0px",
        threshold: 0,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [detailItems.length, detailLoading, expanded, hasMoreDetail, onLoadMore]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        {buildPropiedadesDetailTitle(title)}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Ocultar detalle" : "Mostrar detalle"}
        >
          <span>{expanded ? "Ocultar" : "Mostrar"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {expanded ? (
        <div className="px-2 pb-2 sm:px-3 sm:pb-3">
          <div className="space-y-1">
            {isInitialDetailLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                Cargando detalle...
              </div>
            ) : null}

            {!isInitialDetailLoading && detailItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : null}

            {!isInitialDetailLoading && detailItems.length > 0 ? (
              <div
                ref={detailViewportRef}
                className="overflow-y-auto overscroll-y-contain pr-1"
                style={{ height: PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
              >
                <PropiedadesDetailTable
                  detailItems={detailItems}
                  showContratoColumn={showContratoColumn}
                  valueColumnLabel={valueColumnLabel}
                  refreshEventName="propiedades-dashboard-refresh"
                />
                {hasMoreDetail ? (
                  <div
                    ref={detailLoadSentinelRef}
                    aria-hidden="true"
                    className="h-px w-full shrink-0 opacity-0"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};

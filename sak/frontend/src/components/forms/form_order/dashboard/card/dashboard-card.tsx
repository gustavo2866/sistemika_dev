"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DashboardCardTone =
  | "default"
  | "muted"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type DashboardCardBucket = {
  key: string;
  label: React.ReactNode;
  value?: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  tone?: Exclude<DashboardCardTone, "muted"> | "muted";
};

export type DashboardCardProps = {
  id: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultBucketsOpen?: boolean;
  bucketsOpen?: boolean;
  onBucketsOpenChange?: (open: boolean) => void;
  selectedId?: string | null;
  selectedBucketKey?: string | null;
  onSelect?: (id?: string) => void;
  onBucketSelect?: (payload: { id: string; bucketKey?: string }) => void;
  buckets?: DashboardCardBucket[];
  bucketHeader?: React.ReactNode;
  bucketColumnsClassName?: string;
  bucketHeaderClassName?: string;
  bucketRowClassName?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  titleTone?: DashboardCardTone;
  dotTone?: DashboardCardTone;
  titleClassName?: string;
  dotClassName?: string;
  summaryClassName?: string;
  children?: React.ReactNode;
};

const DOT_TONE_CLASSES: Record<DashboardCardTone, string> = {
  default: "bg-muted-foreground/40",
  muted: "bg-muted-foreground/30",
  info: "bg-blue-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-rose-500",
};

const TITLE_TONE_CLASSES: Record<DashboardCardTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  info: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
};

const BUCKET_TONE_CLASSES: Record<DashboardCardTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  info: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
};

export const DashboardCard = ({
  id,
  title,
  summary,
  defaultBucketsOpen = false,
  bucketsOpen,
  onBucketsOpenChange,
  selectedId,
  selectedBucketKey,
  onSelect,
  onBucketSelect,
  buckets,
  bucketHeader,
  bucketColumnsClassName,
  bucketHeaderClassName,
  bucketRowClassName,
  className,
  headerClassName,
  bodyClassName,
  titleTone = "default",
  dotTone = "default",
  titleClassName,
  dotClassName,
  summaryClassName,
  children,
}: DashboardCardProps) => {
  const isSelectedCard = selectedId === id;
  const isInteractive = Boolean(onSelect);
  const hasBuckets = (buckets?.length ?? 0) > 0;
  const hasBodyContent = hasBuckets || Boolean(children);
  const [internalOpen, setInternalOpen] = useState(defaultBucketsOpen);
  const isOpen = bucketsOpen ?? internalOpen;
  const setOpen = onBucketsOpenChange ?? setInternalOpen;
  const isBodyVisible = !hasBodyContent || isOpen;

  const handleSelect = () => {
    if (!onSelect) return;
    if (selectedId === id && !selectedBucketKey) {
      onSelect(undefined);
      return;
    }
    onSelect(id);
  };

  const handleBucketSelect = (bucketKey: string) => {
    if (!onBucketSelect) return;
    if (selectedId === id && selectedBucketKey === bucketKey) {
      onBucketSelect({ id, bucketKey: undefined });
      return;
    }
    onBucketSelect({ id, bucketKey });
  };

  return (
    <div
      className={cn(
        "min-w-0 rounded-md border bg-card p-1.5 shadow-sm",
        isInteractive ? "cursor-pointer transition hover:bg-muted/30" : "",
        isSelectedCard
          ? "border-primary/70 ring-1 ring-primary/40 bg-primary/5"
          : "border-border",
        className,
      )}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (!isInteractive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <div className={cn("flex flex-col gap-1", headerClassName)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                DOT_TONE_CLASSES[dotTone],
                dotClassName,
              )}
            />
            <div
              className={cn(
                "max-w-[50px] truncate whitespace-nowrap text-[10px] font-semibold leading-snug sm:max-w-[70px]",
                TITLE_TONE_CLASSES[titleTone],
                titleClassName,
              )}
            >
              {title}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {summary ? (
              <div
                className={cn(
                  "text-[9px] text-muted-foreground",
                  summaryClassName,
                )}
              >
                {summary}
              </div>
            ) : null}
            {hasBodyContent ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              tabIndex={-1}
              aria-label={isOpen ? "Ocultar buckets" : "Mostrar buckets"}
              title={isOpen ? "Ocultar buckets" : "Mostrar buckets"}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(!isOpen);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            ) : null}
          </div>
        </div>
      </div>

      {children && isBodyVisible ? (
        <div className={cn("mt-2.5", bodyClassName)}>{children}</div>
      ) : null}

      {hasBuckets && isBodyVisible ? (
        <div className={cn("mt-2.5 rounded-md border border-border/70", bodyClassName)}>
          {bucketHeader ? (
            <div
              className={cn(
                "grid gap-2 border-b border-border/70 bg-muted/30 px-2 py-1 text-[8px] uppercase tracking-wide text-muted-foreground",
                bucketColumnsClassName ?? "grid-cols-[1fr_auto]",
                bucketHeaderClassName,
              )}
            >
              {bucketHeader}
            </div>
          ) : null}
          <div className="divide-y divide-border/60">
            {buckets?.map((bucket) => {
              const isBucketSelected =
                selectedId === id && selectedBucketKey === bucket.key;
              const tone = bucket.tone ?? "default";
              return (
                <button
                  type="button"
                  key={bucket.key}
                  className={cn(
                    "grid w-full items-center gap-2 px-2 py-1.5 text-left text-[9px] hover:bg-muted/40",
                    bucketColumnsClassName ?? "grid-cols-[1fr_auto]",
                    isBucketSelected ? "bg-primary/10 ring-1 ring-primary/30" : "",
                    bucketRowClassName,
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleBucketSelect(bucket.key);
                  }}
                >
                  <span
                    className={cn(
                      "truncate",
                      BUCKET_TONE_CLASSES[tone],
                      bucket.labelClassName,
                    )}
                  >
                    {bucket.label}
                  </span>
                  <span
                    className={cn(
                      "text-right font-semibold",
                      BUCKET_TONE_CLASSES[tone],
                      bucket.valueClassName,
                    )}
                  >
                    {bucket.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

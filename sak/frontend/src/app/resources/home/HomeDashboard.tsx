"use client";

import { type MouseEventHandler, useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router-dom";
import { useGetIdentity } from "ra-core";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  MessageCircle,
  Target,
  Users,
} from "lucide-react";
import { DashboardSectionCard } from "@/components/forms/form_order/dashboard/DashboardSectionCard";
import { Spinner } from "@/components/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  clearHomeDashboardReturnMarker,
  type HomeDashboardPartialKey,
  loadHomeDashboardReturnMarker,
  normalizeHomeDashboardRefreshKeys,
  saveHomeDashboardReturnMarker,
} from "./return-state";
import { loadHomeDashboardSnapshot, saveHomeDashboardSnapshot } from "./state-helpers";

type HomeDashboardSeverity = "urgent" | "high" | "normal";
type HomeDashboardScope = "personal" | "global";

type HomeDashboardEnvironment = {
  key: string;
  label: string;
  color: string;
};

type HomeDashboardItem = {
  key: string;
  label: string;
  count: number;
  severity: HomeDashboardSeverity;
  scope: HomeDashboardScope;
  href: string;
  ctaLabel: string;
  meta?: Record<string, unknown>;
};

type HomeDashboardRadarItem = HomeDashboardItem & {
  sectionLabel: string;
};

type HomeDashboardBundle = {
  generatedAt: string;
  environment: HomeDashboardEnvironment;
  user: {
    id: string | number;
    nombre?: string | null;
  };
  summary: {
    total: number;
    urgent: number;
    high: number;
    normal: number;
  };
  miDia: {
    total: number;
    items: HomeDashboardItem[];
  };
  radar: {
    items: HomeDashboardRadarItem[];
  };
  quickActions: Array<{
    key: string;
    label: string;
    href: string;
  }>;
};

type HomeDashboardPartialResponse = {
  generatedAt: string;
  summary?: HomeDashboardBundle["summary"];
  miDia?: HomeDashboardBundle["miDia"];
  radar?: HomeDashboardBundle["radar"];
};

type IdentityPayload = {
  id?: string | number;
  fullName?: string | null;
  nombre?: string | null;
  avatar?: string | null;
  url_foto?: string | null;
};

const numberFormatter = new Intl.NumberFormat("es-AR");
const generatedAtFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const buildAuthenticatedHeaders = () => {
  const headers = new Headers();

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
};

const fetchHomeDashboardJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path, {
    headers: buildAuthenticatedHeaders(),
  });
  const rawBody = await response.text();

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as { detail?: unknown; message?: unknown };
        const detail =
          typeof parsed.detail === "string"
            ? parsed.detail
            : typeof parsed.message === "string"
              ? parsed.message
              : rawBody;
        if (detail) {
          message = `${message}: ${detail}`;
        }
      } catch {
        message = `${message}: ${rawBody}`;
      }
    }
    throw new Error(message);
  }

  return JSON.parse(rawBody) as T;
};

const fetchHomeDashboardBundle = async (): Promise<HomeDashboardBundle> =>
  fetchHomeDashboardJson<HomeDashboardBundle>(`${apiUrl}/api/dashboard/home/bundle`);

const fetchHomeDashboardPartial = async (
  keys: HomeDashboardPartialKey[],
): Promise<HomeDashboardPartialResponse> => {
  const params = new URLSearchParams();
  params.set("keys", keys.join(","));
  return fetchHomeDashboardJson<HomeDashboardPartialResponse>(
    `${apiUrl}/api/dashboard/home/partial?${params.toString()}`,
  );
};

const formatCount = (value: number) => numberFormatter.format(value);

const formatGeneratedAt = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return generatedAtFormatter.format(parsed);
};

const environmentClassName = (environment?: HomeDashboardEnvironment) => {
  switch (environment?.color) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const severityBadgeClassName = (severity: HomeDashboardSeverity) => {
  switch (severity) {
    case "urgent":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const summaryChipClassName = (key: string) => {
  switch (key) {
    case "urgent":
      return "border-red-200 bg-red-50/80";
    case "high":
      return "border-amber-200 bg-amber-50/80";
    case "normal":
      return "border-slate-200 bg-slate-50/80";
    default:
      return "border-slate-200 bg-white/90";
  }
};

const summaryValueClassName = (key: string) => {
  switch (key) {
    case "urgent":
      return "text-red-700";
    case "high":
      return "text-amber-700";
    case "normal":
      return "text-slate-700";
    default:
      return "text-slate-950";
  }
};

const getQuickActionIcon = (actionKey: string) => {
  if (actionKey.includes("evento")) return CalendarCheck;
  if (actionKey.includes("oportunidad")) return Users;
  return ClipboardCheck;
};

const SummaryChip = ({
  chipKey,
  label,
  value,
  icon: Icon,
}: {
  chipKey: string;
  label: string;
  value: number;
  icon: typeof ClipboardCheck;
}) => (
  <div
    className={cn(
      "flex h-full min-h-[60px] w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-sm sm:min-h-[68px] sm:gap-2.5 sm:px-3 sm:py-2",
      summaryChipClassName(chipKey),
    )}
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-slate-700 sm:h-9 sm:w-9 sm:rounded-xl">
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[10px] sm:tracking-[0.2em]">
        {label}
      </p>
      <p
        className={cn(
          "truncate pt-0.5 text-[15px] font-semibold leading-none sm:text-lg",
          summaryValueClassName(chipKey),
        )}
      >
        {formatCount(value)}
      </p>
    </div>
  </div>
);

const QuickFocusRow = ({
  label,
  value,
  to,
  onClick,
  severity,
  meta,
  icon: Icon,
  iconWrapClassName,
  iconClassName,
}: {
  label: string;
  value: number;
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  severity?: HomeDashboardSeverity;
  meta?: string | null;
  icon?: typeof ClipboardCheck;
  iconWrapClassName?: string;
  iconClassName?: string;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 transition-colors hover:border-slate-300 hover:bg-slate-100/80"
  >
    <div className="flex min-w-0 items-center gap-2">
      {Icon ? (
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border shadow-sm",
            iconWrapClassName,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-none text-slate-900">{label}</p>
        {meta ? <p className="truncate pt-0.5 text-[10px] leading-none text-slate-500">{meta}</p> : null}
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-1.5 py-0 text-[10px] font-semibold",
          severity ? severityBadgeClassName(severity) : "border-slate-200 bg-white text-slate-700",
        )}
      >
        {formatCount(value)}
      </Badge>
      <ArrowRight className="h-3 w-3 text-slate-400" />
    </div>
  </Link>
);

const QuickAgendaRow = ({
  pending,
  overdue,
  to,
  onClick,
}: {
  pending: number;
  overdue: number;
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 transition-colors hover:border-slate-300 hover:bg-slate-100/80"
  >
    <div className="flex min-w-0 items-center gap-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 shadow-sm">
        <CalendarDays className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-none text-slate-900">Agenda</p>
        <p className="truncate pt-0.5 text-[10px] leading-none text-slate-500">Pendientes y vencidos</p>
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className="rounded-full border-slate-200 bg-white px-1.5 py-0 text-[10px] font-semibold text-slate-700"
      >
        P {formatCount(pending)}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-1.5 py-0 text-[10px] font-semibold",
          overdue > 0
            ? severityBadgeClassName("urgent")
            : "border-slate-200 bg-white text-slate-500",
        )}
      >
        V {formatCount(overdue)}
      </Badge>
      <ArrowRight className="h-3 w-3 text-slate-400" />
    </div>
  </Link>
);

const QuickActionButton = ({
  label,
  to,
  onClick,
  icon: Icon,
}: {
  label: string;
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  icon: typeof ClipboardCheck;
}) => (
  <Button
    asChild
    variant="outline"
    className="h-auto min-h-0 justify-start rounded-lg border-white/15 bg-white/6 px-2.5 py-2 text-left text-white hover:bg-white/12 hover:text-white"
  >
    <Link to={to} onClick={onClick} className="flex w-full items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className="rounded-md border border-white/15 bg-white/8 p-1">
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[13px] font-medium">{label}</span>
      </span>
      <ArrowRight className="h-3 w-3 text-white/70" />
    </Link>
  </Button>
);

const getMiDiaMeta = (item: HomeDashboardItem) => {
  if (item.key === "aprobaciones_pendientes") return "Compras";
  return null;
};

const getMiDiaIconProps = (item: HomeDashboardItem) => {
  if (item.key === "chats_nuevos") {
    return {
      icon: MessageCircle,
      iconWrapClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
      iconClassName: "text-cyan-700",
    };
  }

  if (item.key === "aprobaciones_pendientes") {
    return {
      icon: ClipboardCheck,
      iconWrapClassName: "border-amber-200 bg-amber-50 text-amber-700",
      iconClassName: "text-amber-700",
    };
  }

  return {};
};

const buildPathWithReturnTo = (href: string, returnTo: string) => {
  const [pathWithoutHash, hash = ""] = href.split("#");
  const [pathname, queryString = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(queryString);
  if (!params.has("returnTo")) {
    params.set("returnTo", returnTo);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
};

const mergeHomeDashboardBundle = (
  currentBundle: HomeDashboardBundle,
  partial: HomeDashboardPartialResponse,
): HomeDashboardBundle => ({
  ...currentBundle,
  generatedAt: partial.generatedAt ?? currentBundle.generatedAt,
  summary: partial.summary ?? currentBundle.summary,
  miDia: partial.miDia ?? currentBundle.miDia,
  radar: partial.radar ?? currentBundle.radar,
});

const getRefreshKeysForItem = (itemKey: string): HomeDashboardPartialKey[] => {
  switch (itemKey) {
    case "chats_nuevos":
    case "agenda":
    case "agenda_pendiente":
    case "agenda_vencida":
    case "aprobaciones_pendientes":
      return ["miDia", "summary"];
    case "facturas_vencidas":
    case "contratos_proximos_vencer":
    case "contratos_proximos_actualizar":
    case "vacancias_prolongadas":
    case "oportunidades_sin_actividad":
    case "prospects_sin_resolver":
      return ["radar", "summary"];
    default:
      return ["summary"];
  }
};

const getRefreshKeysForQuickAction = (actionKey: string): HomeDashboardPartialKey[] => {
  switch (actionKey) {
    case "nuevo_evento":
      return ["miDia", "summary"];
    case "nueva_oportunidad":
      return ["radar", "summary"];
    case "nueva_orden":
      return ["miDia", "summary"];
    default:
      return ["summary"];
  }
};

export default function HomeDashboard() {
  const location = useLocation();
  const { data: identity, isLoading: identityLoading } = useGetIdentity();
  const [bundle, setBundle] = useState<HomeDashboardBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const returnMarker = loadHomeDashboardReturnMarker(returnTo);
        const snapshot = loadHomeDashboardSnapshot<HomeDashboardBundle>(returnTo);

        if (returnMarker) {
          clearHomeDashboardReturnMarker(returnTo);
        }

        if (snapshot?.bundle && returnMarker) {
          setBundle(snapshot.bundle);
          setIsLoading(false);
        }

        if (!snapshot?.bundle || !returnMarker?.refreshKeys?.length || returnMarker.refreshAll) {
          const nextBundle = await fetchHomeDashboardBundle();
          if (cancelled) return;
          setBundle(nextBundle);
          return;
        }

        const partial = await fetchHomeDashboardPartial(returnMarker.refreshKeys);
        if (cancelled) return;
        setBundle((currentBundle) =>
          currentBundle
            ? mergeHomeDashboardBundle(currentBundle, partial)
            : mergeHomeDashboardBundle(snapshot.bundle, partial),
        );
      } catch (loadError) {
        if (cancelled) return;
        console.error("No se pudo cargar el home dashboard", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el dashboard inicial",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken, returnTo]);

  useEffect(() => {
    if (!bundle) return;
    saveHomeDashboardSnapshot(returnTo, {
      savedAt: Date.now(),
      bundle,
    });
  }, [bundle, returnTo]);

  const identityData = identity as IdentityPayload | undefined;
  const displayName =
    identityData?.fullName ??
    identityData?.nombre ??
    bundle?.user?.nombre ??
    "usuario";
  const avatarSrc = identityData?.avatar ?? identityData?.url_foto ?? "";
  const avatarFallback = displayName.slice(0, 1).toUpperCase() || "U";

  const summaryCards = bundle
    ? [
        {
          key: "total",
          label: "Pendientes",
          value: bundle.summary.total,
          icon: ClipboardCheck,
        },
        {
          key: "urgent",
          label: "Urgente",
          value: bundle.summary.urgent,
          icon: AlertTriangle,
        },
        {
          key: "high",
          label: "Alta",
          value: bundle.summary.high,
          icon: CalendarDays,
        },
        {
          key: "normal",
          label: "Normal",
          value: bundle.summary.normal,
          icon: Target,
        },
      ]
    : [];

  const buildNavigationTarget = (
    href: string,
    refreshKeys: HomeDashboardPartialKey[],
  ) => ({
    to: buildPathWithReturnTo(href, returnTo),
    onClick: () => {
      saveHomeDashboardReturnMarker(returnTo, {
        savedAt: Date.now(),
        refreshKeys: normalizeHomeDashboardRefreshKeys(refreshKeys),
      });
    },
  });

  const errorTitle = bundle
    ? "No se pudo actualizar el dashboard"
    : "No se pudo cargar el dashboard inicial";

  return (
    <div className="w-full space-y-5 pb-8 lg:max-w-[1320px]">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.98)_52%,rgba(239,246,255,0.9)_100%)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Home</h1>
              {bundle?.environment ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em]",
                    environmentClassName(bundle.environment),
                  )}
                >
                  {bundle.environment.label}
                </Badge>
              ) : null}
            </div>

            <p className="max-w-3xl text-sm text-slate-600">
              {identityLoading && !bundle
                ? "Cargando informacion..."
                : `Hola ${displayName}, este es tu tablero operativo consolidado.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-3 py-2 shadow-sm">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarImage src={avatarSrc} />
                <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-[10px] leading-none text-slate-400">
                  {formatGeneratedAt(bundle?.generatedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
          {isLoading && !bundle ? (
            <div className="col-span-full inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-500 shadow-sm">
              <Spinner size="small" />
              Cargando resumen...
            </div>
          ) : (
            summaryCards.map((card) => (
              <SummaryChip
                key={card.key}
                chipKey={card.key}
                label={card.label}
                value={card.value}
                icon={card.icon}
              />
            ))
          )}
        </div>
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50/80">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">{errorTitle}</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              onClick={() => setReloadToken((current) => current + 1)}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <DashboardSectionCard
          className="border-slate-200 bg-white/95 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          headerClassName="gap-1 border-b border-slate-100 pb-1.5"
          contentClassName="space-y-1.5 pt-2"
          title={<span className="text-sm font-semibold text-slate-950">Mi dia</span>}
          actions={
            bundle ? (
              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2 py-0 text-[10px]">
                {formatCount(bundle.miDia.total)}
              </Badge>
            ) : null
          }
        >
          {bundle?.miDia.items.length ? (
            bundle.miDia.items.map((item) =>
              item.key === "agenda" ? (
                <QuickAgendaRow
                  key={item.key}
                  pending={Number(item.meta?.pendientes ?? 0)}
                  overdue={Number(item.meta?.vencidos ?? 0)}
                  {...buildNavigationTarget(item.href, getRefreshKeysForItem(item.key))}
                />
              ) : (
                <QuickFocusRow
                  key={item.key}
                  label={item.label}
                  value={item.count}
                  {...buildNavigationTarget(item.href, getRefreshKeysForItem(item.key))}
                  severity={item.severity}
                  meta={getMiDiaMeta(item)}
                  {...getMiDiaIconProps(item)}
                />
              ),
            )
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-2.5 py-3 text-xs text-slate-500">
              Sin tareas para mostrar.
            </div>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          className="border-slate-200 bg-white/95 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          headerClassName="gap-1 border-b border-slate-100 pb-1.5"
          contentClassName="space-y-1.5 pt-2"
          title={<span className="text-sm font-semibold text-slate-950">Radar</span>}
        >
          {bundle?.radar.items.length ? (
            bundle.radar.items.map((item) => (
              <QuickFocusRow
                key={`${item.sectionLabel}:${item.key}`}
                label={item.label}
                value={item.count}
                {...buildNavigationTarget(item.href, getRefreshKeysForItem(item.key))}
                severity={item.severity}
                meta={item.sectionLabel}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-2.5 py-3 text-xs text-slate-500">
              No hay pendientes para destacar en este momento.
            </div>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          className="border-slate-950 bg-[linear-gradient(180deg,rgba(15,23,42,1)_0%,rgba(30,41,59,0.98)_100%)] text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)]"
          headerClassName="gap-1 border-b border-white/10 pb-1.5"
          contentClassName="space-y-1.5 pt-2"
          title={<span className="text-sm font-semibold text-white">Acciones</span>}
        >
          {(bundle?.quickActions ?? []).map((action) => {
            const ActionIcon = getQuickActionIcon(action.key);

            return (
              <QuickActionButton
                key={action.key}
                label={action.label}
                {...buildNavigationTarget(action.href, getRefreshKeysForQuickAction(action.key))}
                icon={ActionIcon}
              />
            );
          })}
        </DashboardSectionCard>
      </div>
    </div>
  );
}

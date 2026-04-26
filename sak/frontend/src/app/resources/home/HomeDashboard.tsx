"use client";

import { type MouseEventHandler, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ListContextProvider,
  ResourceContextProvider,
  useGetIdentity,
} from "ra-core";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  MessageCircle,
  RefreshCcw,
  ShoppingCart,
  Target,
  Users,
} from "lucide-react";
import {
  DashboardSectionCard,
  buildListFilters,
  useMinWidth,
} from "@/components/forms/form_order";
import { FilterForm, StyledFilterDiv } from "@/components/filter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  clearHomeDashboardReturnMarker,
  type HomeDashboardPartialKey,
  loadHomeDashboardReturnMarker,
  normalizeHomeDashboardRefreshKeys,
  saveHomeDashboardReturnMarker,
} from "./return-state";
import {
  clearHomeDashboardSnapshot,
  loadHomeDashboardSnapshot,
  saveHomeDashboardSnapshot,
} from "./state-helpers";
import {
  type PropDashboardDetalleResponse,
  PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT,
  PROP_DASHBOARD_DETAIL_PAGE_SIZE,
} from "../inmobiliaria/propiedades-dashboard/model";
import {
  buildPropiedadesDetailTitle,
  PropiedadesDetailTable,
  type PropiedadesDetailTableItem,
} from "../inmobiliaria/propiedades-dashboard/components/main-panel/propiedades-detail-table";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "../inmobiliaria/propiedades/dialog_styles";
import { excludeMantenimientoTipoOperacion } from "../inmobiliaria/propiedades/model";

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
  miDia: {
    total: number;
    items: HomeDashboardItem[];
  };
  radar: {
    items: HomeDashboardRadarItem[];
  };
};

type HomeDashboardSection = {
  key: string;
  label: string;
  description: string;
  items: HomeDashboardItem[];
};

type HomeDashboardContextResponse = Pick<
  HomeDashboardBundle,
  "generatedAt" | "environment" | "user"
>;

type HomeDashboardDomainKey =
  | "personal"
  | "poorders"
  | "oportunidades"
  | "contratos"
  | "propiedades";

type HomeDashboardSectionResponse = {
  generatedAt: string;
  section: HomeDashboardSection;
};

type HomeDashboardPartialResponse = {
  generatedAt: string;
  miDia?: HomeDashboardBundle["miDia"];
  radar?: HomeDashboardBundle["radar"];
};

type HomeDashboardNavigationTarget = {
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

type RadarAreaGroup = {
  label: string;
  items: HomeDashboardRadarItem[];
};

type RadarAreaConfig = {
  description: string;
  icon: typeof ClipboardCheck;
  panelClassName: string;
  headerIconClassName: string;
  headerEyebrowClassName: string;
  tileClassName: string;
  tileIconClassName: string;
  tileMetaClassName: string;
  tileArrowClassName: string;
};

type MiDiaTileConfig = {
  icon: typeof ClipboardCheck;
  tileClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
  countClassName: string;
  eyebrowClassName: string;
  metaClassName: string;
  arrowClassName: string;
};

type QuickActionButtonTone = "dark" | "light";

const RADAR_AREA_ORDER = ["Compras", "CRM", "Inmobiliaria"] as const;
const HOME_DASHBOARD_DOMAIN_KEYS = [
  "personal",
  "poorders",
  "oportunidades",
  "contratos",
  "propiedades",
] as const satisfies readonly HomeDashboardDomainKey[];
const HOME_DASHBOARD_DOMAIN_ENDPOINTS: Record<HomeDashboardDomainKey, string> = {
  personal: "personal",
  poorders: "poorders",
  oportunidades: "oportunidades",
  contratos: "contratos",
  propiedades: "propiedades",
};
const HOME_DASHBOARD_RADAR_PRIORITY_GROUPS = [
  ["aprobaciones_pendientes"],
  ["solicitudes_pendientes"],
  ["contratos_proximos_vencer"],
  ["contratos_proximos_actualizar"],
  ["vacancias_prolongadas"],
  ["oportunidades_sin_actividad"],
  ["oportunidades_prospect"],
] as const;
const HOME_DASHBOARD_RADAR_EXCLUDED_KEYS = new Set([
  "chats_nuevos",
  "agenda_pendiente",
  "agenda_vencida",
  "mis_compras",
]);

type IdentityPayload = {
  id?: string | number;
  fullName?: string | null;
  nombre?: string | null;
  avatar?: string | null;
  url_foto?: string | null;
};

const numberFormatter = new Intl.NumberFormat("es-AR");

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

const getHomeDashboardSectionItemsByKey = (section: HomeDashboardSection) =>
  Object.fromEntries(section.items.map((item) => [item.key, item])) as Record<
    string,
    HomeDashboardItem
  >;

const buildHomeDashboardMiDiaPayload = (
  personal: HomeDashboardSection,
  poorders: HomeDashboardSection,
): HomeDashboardBundle["miDia"] => {
  const personalItems = getHomeDashboardSectionItemsByKey(personal);
  const poorderItems = getHomeDashboardSectionItemsByKey(poorders);
  const agendaPendiente = personalItems.agenda_pendiente;
  const agendaVencida = personalItems.agenda_vencida;
  const agendaItem: HomeDashboardItem = {
    key: "agenda",
    label: "Agenda",
    count: agendaPendiente.count + agendaVencida.count,
    severity: agendaVencida.count > 0 ? "urgent" : "high",
    scope: "personal",
    href: agendaVencida.href || agendaPendiente.href,
    ctaLabel: "Ver agenda",
    meta: {
      pendientes: agendaPendiente.count,
      vencidos: agendaVencida.count,
    },
  };
  const items = [personalItems.chats_nuevos, agendaItem, poorderItems.mis_compras];

  return {
    total: items.reduce((total, item) => total + item.count, 0),
    items,
  };
};

const buildHomeDashboardRadarPayload = (
  sections: HomeDashboardSection[],
): HomeDashboardBundle["radar"] => {
  const availableItems = sections.flatMap((section) =>
    section.items
      .filter((item) => !HOME_DASHBOARD_RADAR_EXCLUDED_KEYS.has(item.key))
      .map((item) => ({
        ...item,
        sectionLabel: section.label,
      })),
  );
  const itemsByKey = new Map(availableItems.map((item) => [item.key, item]));
  const items: HomeDashboardRadarItem[] = [];

  for (const group of HOME_DASHBOARD_RADAR_PRIORITY_GROUPS) {
    const selectedItem = group.map((itemKey) => itemsByKey.get(itemKey)).find(Boolean);
    if (selectedItem) {
      items.push(selectedItem);
    }
  }

  return { items };
};

const getRequiredHomeDashboardSection = (
  sections: Partial<Record<HomeDashboardDomainKey, HomeDashboardSection>>,
  domain: HomeDashboardDomainKey,
) => {
  const section = sections[domain];
  if (!section) {
    throw new Error(`No se recibio la seccion ${domain} del home dashboard`);
  }
  return section;
};

const composeHomeDashboardBundle = (
  context: HomeDashboardContextResponse,
  sections: Record<HomeDashboardDomainKey, HomeDashboardSection>,
): HomeDashboardBundle => ({
  ...context,
  miDia: buildHomeDashboardMiDiaPayload(sections.personal, sections.poorders),
  radar: buildHomeDashboardRadarPayload([
    sections.poorders,
    sections.contratos,
    sections.propiedades,
    sections.oportunidades,
  ]),
});

const fetchHomeDashboardContext = async (): Promise<HomeDashboardContextResponse> =>
  fetchHomeDashboardJson<HomeDashboardContextResponse>(`${apiUrl}/api/dashboard/home/context`);

const fetchHomeDashboardSectionResponse = async (
  domain: HomeDashboardDomainKey,
): Promise<HomeDashboardSectionResponse> =>
  fetchHomeDashboardJson<HomeDashboardSectionResponse>(
    `${apiUrl}/api/dashboard/home/${HOME_DASHBOARD_DOMAIN_ENDPOINTS[domain]}`,
  );

const fetchHomeDashboardBundle = async (): Promise<HomeDashboardBundle> => {
  const [context, ...sectionResponses] = await Promise.all([
    fetchHomeDashboardContext(),
    ...HOME_DASHBOARD_DOMAIN_KEYS.map((domain) => fetchHomeDashboardSectionResponse(domain)),
  ]);
  const sections = Object.fromEntries(
    HOME_DASHBOARD_DOMAIN_KEYS.map((domain, index) => [
      domain,
      sectionResponses[index].section,
    ]),
  ) as Record<HomeDashboardDomainKey, HomeDashboardSection>;

  return composeHomeDashboardBundle(context, sections);
};

const getHomeDashboardPartialDomains = (
  keys: HomeDashboardPartialKey[],
): HomeDashboardDomainKey[] => {
  const domains = new Set<HomeDashboardDomainKey>();

  if (keys.includes("miDia")) {
    domains.add("personal");
    domains.add("poorders");
  }

  if (keys.includes("radar")) {
    domains.add("poorders");
    domains.add("oportunidades");
    domains.add("contratos");
    domains.add("propiedades");
  }

  return Array.from(domains);
};

const fetchHomeDashboardPartial = async (
  keys: HomeDashboardPartialKey[],
): Promise<HomeDashboardPartialResponse> => {
  const domains = getHomeDashboardPartialDomains(keys);
  if (!domains.length) {
    return { generatedAt: new Date().toISOString() };
  }

  const responses = await Promise.all(
    domains.map(async (domain) => ({
      domain,
      response: await fetchHomeDashboardSectionResponse(domain),
    })),
  );
  const sections = Object.fromEntries(
    responses.map(({ domain, response }) => [domain, response.section]),
  ) as Partial<Record<HomeDashboardDomainKey, HomeDashboardSection>>;
  const partial: HomeDashboardPartialResponse = {
    generatedAt: responses[responses.length - 1]?.response.generatedAt ?? new Date().toISOString(),
  };

  if (keys.includes("miDia")) {
    partial.miDia = buildHomeDashboardMiDiaPayload(
      getRequiredHomeDashboardSection(sections, "personal"),
      getRequiredHomeDashboardSection(sections, "poorders"),
    );
  }

  if (keys.includes("radar")) {
    partial.radar = buildHomeDashboardRadarPayload([
      getRequiredHomeDashboardSection(sections, "poorders"),
      getRequiredHomeDashboardSection(sections, "contratos"),
      getRequiredHomeDashboardSection(sections, "propiedades"),
      getRequiredHomeDashboardSection(sections, "oportunidades"),
    ]);
  }

  return partial;
};

const formatCount = (value: number) => numberFormatter.format(value);

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

const getQuickActionIcon = (actionKey: string) => {
  if (actionKey.includes("evento")) return CalendarCheck;
  if (actionKey.includes("oportunidad")) return Target;
  if (actionKey.includes("orden")) return ShoppingCart;
  if (actionKey === "contactos") return Users;
  return ClipboardCheck;
};

const getQuickActionDescription = (actionKey: string) => {
  switch (actionKey) {
    case "nuevo_evento":
      return "Crear nuevo evento";
    case "nueva_oportunidad":
      return "Registrar oportunidad";
    case "nueva_orden":
      return "Crear nueva orden";
    case "contactos":
      return "Ver lista de contactos";
    default:
      return null;
  }
};

const getMiDiaTileConfig = (item: HomeDashboardItem): MiDiaTileConfig => {
  if (item.key === "chats_nuevos") {
    return {
      icon: MessageCircle,
      tileClassName:
        "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/45 hover:shadow-[0_10px_20px_rgba(34,211,238,0.10)]",
      iconWrapClassName: "border-cyan-200 bg-cyan-50 text-cyan-600 shadow-[0_1px_2px_rgba(34,211,238,0.08)]",
      iconClassName: "text-cyan-600",
      countClassName: "text-slate-950",
      eyebrowClassName: "text-cyan-600/75",
      metaClassName: "text-slate-400",
      arrowClassName: "text-slate-400",
    };
  }

  if (item.key === "agenda") {
    return {
      icon: CalendarDays,
      tileClassName:
        "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/45 hover:shadow-[0_10px_20px_rgba(139,92,246,0.10)]",
      iconWrapClassName: "border-violet-200 bg-violet-50 text-violet-600 shadow-[0_1px_2px_rgba(139,92,246,0.08)]",
      iconClassName: "text-violet-600",
      countClassName: "text-slate-950",
      eyebrowClassName: "text-violet-600/75",
      metaClassName: "text-slate-400",
      arrowClassName: "text-slate-400",
    };
  }

  if (item.key === "mis_compras") {
    return {
      icon: ShoppingCart,
      tileClassName:
        "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/45 hover:shadow-[0_10px_20px_rgba(59,130,246,0.10)]",
      iconWrapClassName: "border-blue-200 bg-blue-50 text-blue-600 shadow-[0_1px_2px_rgba(59,130,246,0.08)]",
      iconClassName: "text-blue-600",
      countClassName: "text-slate-950",
      eyebrowClassName: "text-blue-600/75",
      metaClassName: "text-slate-400",
      arrowClassName: "text-slate-400",
    };
  }

  return {
    icon: ClipboardCheck,
    tileClassName:
      "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/45 hover:shadow-[0_10px_20px_rgba(16,185,129,0.10)]",
    iconWrapClassName: "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-[0_1px_2px_rgba(16,185,129,0.08)]",
    iconClassName: "text-emerald-600",
    countClassName: "text-slate-950",
    eyebrowClassName: "text-emerald-600/75",
    metaClassName: "text-slate-400",
    arrowClassName: "text-slate-400",
  };
};

const getMiDiaTileLabel = (item: HomeDashboardItem) => {
  if (item.key === "agenda") {
    return "Agenda";
  }
  return item.label;
};

const getMiDiaTileMeta = (item: HomeDashboardItem) => {
  if (item.key === "agenda") {
    const pending = Number(item.meta?.pendientes ?? 0);
    const overdue = Number(item.meta?.vencidos ?? 0);
    return overdue > 0 ? `${pending} pendientes / ${overdue} vencidos` : `${pending} pendientes`;
  }
  return getMiDiaMeta(item);
};

const getMiDiaTileValue = (item: HomeDashboardItem) => {
  if (item.key === "agenda") {
    return Number(item.meta?.pendientes ?? 0) + Number(item.meta?.vencidos ?? 0);
  }
  return item.count;
};

const MiDiaTile = ({
  item,
  target,
  compact = false,
}: {
  item: HomeDashboardItem;
  target: HomeDashboardNavigationTarget;
  compact?: boolean;
}) => {
  const config = getMiDiaTileConfig(item);
  const Icon = config.icon;
  const value = getMiDiaTileValue(item);
  const meta = getMiDiaTileMeta(item);

  return (
    <Link
      to={target.to}
      onClick={target.onClick}
      className={cn(
        "group flex w-full min-w-0 flex-col justify-between overflow-hidden border shadow-[0_6px_14px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5",
        compact
          ? "min-h-[54px] gap-1 rounded-xl px-2 py-1.5"
          : "min-h-[60px] gap-1.5 rounded-[14px] px-2.5 py-2",
        config.tileClassName,
      )}
    >
      {/* Top row: icon + number (secondary) */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg border shadow-sm",
            compact ? "h-5 w-5" : "h-6 w-6",
            config.iconWrapClassName,
          )}
        >
          <Icon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", config.iconClassName)} />
        </span>
        <p className={cn(compact ? "text-[13px]" : "text-[14px]", "font-semibold leading-none tracking-tight text-slate-500", config.countClassName)}>
          {formatCount(value)}
        </p>
      </div>

      {/* Label + meta stacked */}
      <div className="min-w-0 space-y-0.5">
        <p className={cn(compact ? "text-[11px]" : "text-[12px]", "font-semibold leading-tight text-slate-950")}>
          {getMiDiaTileLabel(item)}
        </p>
        {meta ? (
          <p className={cn(compact ? "text-[9px]" : "text-[10px]", "leading-tight", config.metaClassName)}>{meta}</p>
        ) : null}
      </div>

      {/* Arrow bottom-right */}
      <div className="flex justify-end">
        <ArrowRight
          className={cn(
            "h-2.5 w-2.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
            config.arrowClassName,
          )}
        />
      </div>
    </Link>
  );
};

const MiDiaCompactContent = ({
  items,
  buildNavigationTarget,
  compact = false,
}: {
  items: HomeDashboardItem[];
  buildNavigationTarget: (
    href: string,
    refreshKeys: HomeDashboardPartialKey[],
  ) => HomeDashboardNavigationTarget;
  compact?: boolean;
}) => {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-2.5 py-3 text-xs text-slate-500">
        Sin tareas para mostrar.
      </div>
    );
  }

  return (
    <div className={cn("grid", compact ? "gap-1.5" : "gap-2")}>
      {items.map((item) => (
        <MiDiaTile
          key={item.key}
          item={item}
          target={buildNavigationTarget(item.href, getRefreshKeysForItem(item.key))}
          compact={compact}
        />
      ))}
    </div>
  );
};

const RadarTileContent = ({
  item,
  areaConfig,
}: {
  item: HomeDashboardRadarItem;
  areaConfig: RadarAreaConfig;
}) => {
  const Icon = getRadarItemIcon(item);

  return (
    <>
      {/* Top row: icon + secondary number */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border shadow-sm",
            areaConfig.tileIconClassName,
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <p className="text-[14px] font-semibold leading-none tracking-tight text-slate-500">
          {formatCount(item.count)}
        </p>
      </div>

      {/* Title + subtitle stacked tight */}
      <div className="space-y-0.5">
        <p className="text-[12px] font-semibold leading-tight text-slate-950">
          {getRadarHeadline(item)}
        </p>
        <p className="text-[10px] font-medium leading-tight text-slate-500">
          {getRadarSubtitle(item)}
        </p>
      </div>

      {/* Arrow */}
      <div className="flex justify-end">
        <ArrowRight
          className={cn(
            "h-2.5 w-2.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
            areaConfig.tileArrowClassName,
          )}
        />
      </div>
    </>
  );
};

const RadarTileLink = ({
  item,
  areaConfig,
  target,
}: {
  item: HomeDashboardRadarItem;
  areaConfig: RadarAreaConfig;
  target: HomeDashboardNavigationTarget;
}) => (
  <Link
    to={target.to}
    onClick={target.onClick}
    className={cn(
      "group flex min-h-[60px] w-full flex-col justify-between gap-1.5 rounded-[14px] border px-2.5 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.12)]",
      areaConfig.tileClassName,
    )}
  >
    <RadarTileContent item={item} areaConfig={areaConfig} />
  </Link>
);

const RadarTileButton = ({
  item,
  areaConfig,
  onClick,
}: {
  item: HomeDashboardRadarItem;
  areaConfig: RadarAreaConfig;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group flex min-h-[60px] w-full flex-col justify-between gap-1.5 rounded-[14px] border px-2.5 py-2 text-left shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.12)]",
      areaConfig.tileClassName,
    )}
  >
    <RadarTileContent item={item} areaConfig={areaConfig} />
  </button>
);

const RadarGroupedContent = ({
  items,
  buildNavigationTarget,
  onOpenVacanciasDialog,
}: {
  items: HomeDashboardRadarItem[];
  buildNavigationTarget: (
    href: string,
    refreshKeys: HomeDashboardPartialKey[],
  ) => HomeDashboardNavigationTarget;
  onOpenVacanciasDialog: () => void;
}) => {
  const groups = groupRadarItems(items);

  if (!groups.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-2.5 py-3 text-xs text-slate-500">
        No hay pendientes para destacar en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 xl:space-y-2">
      {groups.map((group) => {
        const areaConfig = getRadarAreaConfig(group.label);
        const AreaIcon = areaConfig.icon;

        return (
          <section
            key={group.label}
            className={cn(
              "rounded-[16px] border p-2 shadow-[0_6px_14px_rgba(15,23,42,0.04)] lg:grid lg:grid-cols-[88px_minmax(0,1fr)] lg:items-start lg:gap-2 xl:p-2.5 xl:grid-cols-[96px_minmax(0,1fr)] xl:gap-2.5 2xl:grid-cols-[108px_minmax(0,1fr)]",
              areaConfig.panelClassName,
            )}
          >
            <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2 lg:min-h-full lg:flex-col lg:items-start lg:justify-start lg:border-b-0 lg:border-r lg:pb-0 lg:pr-1.5 xl:pr-2">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border shadow-sm",
                  areaConfig.headerIconClassName,
                )}
              >
                <AreaIcon className="h-3 w-3" />
              </span>
              <div className="min-w-0">
                <p className={cn("text-[10px] font-semibold uppercase tracking-[0.10em]", areaConfig.headerEyebrowClassName)}>
                  {group.label}
                </p>
                <p className="text-[11px] leading-tight text-slate-500">{areaConfig.description}</p>
              </div>
            </div>

            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:mt-0 lg:grid-cols-3 xl:gap-2">
              {group.items.map((item) =>
                item.key === "vacancias_prolongadas" ? (
                  <RadarTileButton
                    key={`${group.label}:${item.key}`}
                    item={item}
                    areaConfig={areaConfig}
                    onClick={onOpenVacanciasDialog}
                  />
                ) : (
                  <RadarTileLink
                    key={`${group.label}:${item.key}`}
                    item={item}
                    areaConfig={areaConfig}
                    target={buildNavigationTarget(item.href, getRefreshKeysForItem(item.key))}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const QuickActionButton = ({
  label,
  to,
  onClick,
  icon: Icon,
  description,
  tone = "dark",
}: {
  label: string;
  to: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  icon: typeof ClipboardCheck;
  description?: string | null;
  tone?: QuickActionButtonTone;
}) => (
  <Button
    asChild
    variant="outline"
    className={cn(
      "group h-auto min-h-0 w-full min-w-0 justify-start rounded-xl px-2.5 py-2 text-left sm:px-3 sm:py-2",
      tone === "dark"
        ? "border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
        : "border-slate-200 bg-white text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50",
    )}
  >
    <Link to={to} onClick={onClick} className="flex w-full min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
          tone === "dark"
            ? "border-white/15 bg-white/8 text-white"
            : "border-slate-200 bg-slate-50 text-slate-500",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold leading-tight">{label}</span>
        {description ? (
          <span className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "block text-[9px] leading-tight",
                tone === "dark" ? "text-white/60" : "text-slate-400",
              )}
            >
              {description}
            </span>
            <ArrowRight
              className={cn(
                "h-[7px] w-[7px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
                tone === "dark" ? "text-white/50" : "text-slate-400",
              )}
            />
          </span>
        ) : (
          <span className="flex justify-end">
            <ArrowRight
              className={cn(
                "h-[7px] w-[7px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
                tone === "dark" ? "text-white/50" : "text-slate-400",
              )}
            />
          </span>
        )}
      </span>
    </Link>
  </Button>
);

const getMiDiaMeta = (item: HomeDashboardItem) => {
  if (item.key !== "mis_compras") {
    return null;
  }

  const estados = item.meta?.estados;
  return typeof estados === "string" && estados.trim()
    ? `Estados: ${estados}`
    : "Estados: solicitada, emitida, aprobada";
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
  miDia: partial.miDia ?? currentBundle.miDia,
  radar: partial.radar ?? currentBundle.radar,
});

const getRefreshKeysForItem = (itemKey: string): HomeDashboardPartialKey[] => {
  switch (itemKey) {
    case "chats_nuevos":
    case "agenda":
    case "agenda_pendiente":
    case "agenda_vencida":
    case "mis_compras":
      return ["miDia"];
    case "aprobaciones_pendientes":
    case "solicitudes_pendientes":
    case "contratos_proximos_vencer":
    case "contratos_proximos_actualizar":
    case "vacancias_prolongadas":
    case "oportunidades_sin_actividad":
    case "oportunidades_prospect":
      return ["radar"];
    default:
      return ["miDia", "radar"];
  }
};

const getRadarAreaConfig = (label: string): RadarAreaConfig => {
  switch (label) {
    case "Compras":
      return {
        description: "Solicitudes y aprobaciones",
        icon: ShoppingCart,
        panelClassName:
          "border-blue-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.72)_0%,rgba(255,255,255,0.98)_100%)]",
        headerIconClassName: "border-blue-200 bg-blue-50 text-blue-700",
        headerEyebrowClassName: "text-blue-700/80",
        tileClassName:
          "border-blue-100 bg-[linear-gradient(180deg,#f5f9ff_0%,#ebf3ff_100%)] text-slate-900 hover:border-blue-200 hover:bg-[linear-gradient(180deg,#edf5ff_0%,#e2efff_100%)]",
        tileIconClassName: "border-blue-200 bg-blue-50 text-blue-600",
        tileMetaClassName: "text-slate-500",
        tileArrowClassName: "text-slate-400",
      };
    case "CRM":
      return {
        description: "Oportunidades y prospectos",
        icon: Target,
        panelClassName:
          "border-emerald-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.72)_0%,rgba(255,255,255,0.98)_100%)]",
        headerIconClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
        headerEyebrowClassName: "text-emerald-700/80",
        tileClassName:
          "border-emerald-100 bg-[linear-gradient(180deg,#f4fdf8_0%,#ebf9f1_100%)] text-slate-900 hover:border-emerald-200 hover:bg-[linear-gradient(180deg,#edf9f2_0%,#e3f6eb_100%)]",
        tileIconClassName: "border-emerald-200 bg-emerald-50 text-emerald-600",
        tileMetaClassName: "text-slate-500",
        tileArrowClassName: "text-slate-400",
      };
    case "Inmobiliaria":
      return {
        description: "Contratos y disponibilidad",
        icon: Building2,
        panelClassName:
          "border-orange-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.72)_0%,rgba(255,255,255,0.98)_100%)]",
        headerIconClassName: "border-amber-200 bg-amber-50 text-amber-700",
        headerEyebrowClassName: "text-amber-700/80",
        tileClassName:
          "border-orange-100 bg-[linear-gradient(180deg,#fff8f1_0%,#fff1e6_100%)] text-slate-900 hover:border-orange-200 hover:bg-[linear-gradient(180deg,#fff2e8_0%,#ffe8d7_100%)]",
        tileIconClassName: "border-orange-200 bg-orange-50 text-orange-600",
        tileMetaClassName: "text-slate-500",
        tileArrowClassName: "text-slate-400",
      };
    default:
      return {
        description: "Indicadores operativos",
        icon: ClipboardCheck,
        panelClassName:
          "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,0.98)_100%)]",
        headerIconClassName: "border-slate-200 bg-slate-50 text-slate-700",
        headerEyebrowClassName: "text-slate-600",
        tileClassName:
          "border-white/10 bg-[linear-gradient(180deg,#475569_0%,#334155_100%)] text-white hover:bg-[linear-gradient(180deg,#334155_0%,#1e293b_100%)]",
        tileIconClassName: "border-white/15 bg-white/10 text-white",
        tileMetaClassName: "text-white/80",
        tileArrowClassName: "text-white/80",
      };
  }
};

const getRadarItemIcon = (item: HomeDashboardRadarItem) => {
  switch (item.key) {
    case "aprobaciones_pendientes":
      return ClipboardCheck;
    case "solicitudes_pendientes":
      return FileText;
    case "contratos_proximos_vencer":
    case "contratos_proximos_actualizar":
      return CalendarDays;
    case "vacancias_prolongadas":
      return Building2;
    case "oportunidades_sin_actividad":
      return Target;
    case "oportunidades_prospect":
      return Users;
    default:
      return ClipboardCheck;
  }
};

const getRadarHeadline = (item: HomeDashboardRadarItem) => {
  switch (item.key) {
    case "aprobaciones_pendientes":
      return "Aprobaciones";
    case "solicitudes_pendientes":
      return "Solicitudes";
    case "oportunidades_sin_actividad":
    case "oportunidades_prospect":
      return "Oportunidades";
    case "contratos_proximos_vencer":
    case "contratos_proximos_actualizar":
      return "Contratos";
    case "vacancias_prolongadas":
      return "Propiedades";
    default:
      return item.label;
  }
};

const getRadarSubtitle = (item: HomeDashboardRadarItem) => {
  switch (item.key) {
    case "aprobaciones_pendientes":
      return "Pendientes";
    case "solicitudes_pendientes":
      return "Pendientes";
    case "oportunidades_sin_actividad":
      return "Inactivas > 30 dias";
    case "oportunidades_prospect":
      return "Prospect";
    case "contratos_proximos_vencer":
      return "Vencimiento < 60 dias";
    case "contratos_proximos_actualizar":
      return "Actualizacion < 45 dias";
    case "vacancias_prolongadas":
      return "Vacantes > 15 dias";
    default:
      return item.label;
  }
};

const groupRadarItems = (items: HomeDashboardRadarItem[]): RadarAreaGroup[] => {
  const grouped = new Map<string, HomeDashboardRadarItem[]>();

  items.forEach((item) => {
    const label = String(item.sectionLabel || "Otros");
    const current = grouped.get(label) ?? [];
    current.push(item);
    grouped.set(label, current);
  });

  const orderedLabels = new Set<string>(RADAR_AREA_ORDER);
  const orderedGroups = RADAR_AREA_ORDER
    .filter((label) => grouped.has(label))
    .map((label) => ({
      label,
      items: grouped.get(label) ?? [],
    }));

  const extraGroups = Array.from(grouped.entries())
    .filter(([label]) => !orderedLabels.has(label))
    .map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));

  return [...orderedGroups, ...extraGroups];
};

const getRefreshKeysForQuickAction = (actionKey: string): HomeDashboardPartialKey[] => {
  switch (actionKey) {
    case "nuevo_evento":
      return ["miDia"];
    case "nueva_oportunidad":
      return ["radar"];
    case "nueva_orden":
      return ["miDia"];
    case "nuevo_contacto":
      return ["radar"];
    default:
      return ["miDia", "radar"];
  }
};

const HOME_QUICK_ACTIONS = [
  { key: "nuevo_evento", label: "Nuevo evento", href: "/crm/crm-eventos/create" },
  { key: "nueva_oportunidad", label: "Nueva oportunidad", href: "/crm/oportunidades/create" },
  { key: "nueva_orden", label: "Nueva orden", href: "/po-orders/create" },
  { key: "contactos", label: "Contactos", href: "/crm/contactos" },
] as const;

const HOME_DASHBOARD_ACCORDION_BREAKPOINT = 1024;
const sectionCardClassName =
  "min-w-0 w-full gap-0 border-slate-200 bg-white/95 py-0 shadow-[0_6px_16px_rgba(15,23,42,0.04)]";
const sectionCardHeaderClassName = "gap-1 border-b border-slate-100 px-3 pt-1.5 !pb-1.5 sm:px-4 xl:pt-2 xl:!pb-2";
const sectionCardContentClassName = "space-y-1.5 px-3 py-1.5 sm:px-4 xl:py-2";
const miDiaDesktopCardContentClassName = "space-y-1.5 px-2 py-1.5 xl:py-2";
const VACANCIAS_DIALOG_FILTERS = buildListFilters(
  [
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-[180px] sm:w-[220px]",
        choicesFilter: excludeMantenimientoTipoOperacion,
      },
    },
  ],
  { keyPrefix: "home-vacancias-dialog" },
);

const HomeDashboardMobileSection = ({
  value,
  title,
  actions,
  dark = false,
  children,
}: {
  value: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  dark?: boolean;
  children: React.ReactNode;
}) => (
  <AccordionItem
    value={value}
    className={cn(
      "overflow-hidden rounded-2xl border shadow-sm",
      dark
        ? "border-slate-950 bg-[linear-gradient(180deg,rgba(15,23,42,1)_0%,rgba(30,41,59,0.98)_100%)] text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)]"
        : "border-slate-200 bg-white/95 shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
    )}
  >
    <AccordionTrigger
      className={cn(
        "px-4 py-3 hover:no-underline",
        dark ? "border-b border-white/10 text-white" : "border-b border-slate-100 text-slate-950",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
        <div className="min-w-0">{title}</div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </AccordionTrigger>
    <AccordionContent className={cn("px-4 pb-4 pt-2", dark ? "text-white" : "")}>
      {children}
    </AccordionContent>
  </AccordionItem>
);

const noop = () => undefined;

export default function HomeDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktopDashboardCards = useMinWidth(HOME_DASHBOARD_ACCORDION_BREAKPOINT);
  const { data: identity } = useGetIdentity();
  const [bundle, setBundle] = useState<HomeDashboardBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vacanciasDialogOpen, setVacanciasDialogOpen] = useState(false);
  const [vacanciasDialogData, setVacanciasDialogData] = useState<PropDashboardDetalleResponse | null>(
    null,
  );
  const [vacanciasDialogPage, setVacanciasDialogPage] = useState(1);
  const [vacanciasDialogLoading, setVacanciasDialogLoading] = useState(false);
  const [vacanciasDialogError, setVacanciasDialogError] = useState<string | null>(null);
  const [vacanciasTipoOperacionId, setVacanciasTipoOperacionId] = useState<string | undefined>(
    undefined,
  );
  const vacanciasViewportRef = useRef<HTMLDivElement | null>(null);
  const vacanciasLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const vacanciasLoadingMoreRef = useRef(false);
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
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
          setIsRefreshing(false);
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

  useEffect(() => {
    if (!vacanciasDialogLoading) {
      vacanciasLoadingMoreRef.current = false;
    }
  }, [vacanciasDialogLoading]);

  useEffect(() => {
    if (!vacanciasDialogOpen) {
      return;
    }

    let cancelled = false;
    setVacanciasDialogLoading(true);
    setVacanciasDialogError(null);

    const loadVacanciasDialog = async () => {
      try {
        const params = new URLSearchParams();
        params.set("alertKey", "vacancia_gt_90");
        params.set("page", String(vacanciasDialogPage));
        params.set("pageSize", String(PROP_DASHBOARD_DETAIL_PAGE_SIZE));
        if (vacanciasTipoOperacionId) {
          params.set("tipoOperacionId", vacanciasTipoOperacionId);
        }

        const response = await fetchHomeDashboardJson<PropDashboardDetalleResponse>(
          `${apiUrl}/api/dashboard/propiedades/detalle-alerta?${params.toString()}`,
        );

        if (cancelled) return;

        setVacanciasDialogData((current) => {
          if (vacanciasDialogPage === 1 || !current) {
            return response;
          }

          const seenKeys = new Set(
            current.data.map(
              (item) => `${item.propiedad_id}-${item.vacancia_fecha ?? item.estado_fecha ?? "sin-fecha"}`,
            ),
          );
          const appendedData = response.data.filter((item) => {
            const itemKey = `${item.propiedad_id}-${item.vacancia_fecha ?? item.estado_fecha ?? "sin-fecha"}`;
            if (seenKeys.has(itemKey)) {
              return false;
            }
            seenKeys.add(itemKey);
            return true;
          });

          return {
            ...response,
            data: [...current.data, ...appendedData],
          };
        });
      } catch (loadError) {
        if (cancelled) return;
        console.error("No se pudo cargar el detalle de vacancias prolongadas", loadError);
        setVacanciasDialogError(
          loadError instanceof Error ? loadError.message : "No se pudo cargar el detalle",
        );
      } finally {
        if (!cancelled) {
          setVacanciasDialogLoading(false);
        }
      }
    };

    loadVacanciasDialog();

    return () => {
      cancelled = true;
    };
  }, [vacanciasDialogOpen, vacanciasDialogPage, vacanciasTipoOperacionId]);

  const identityData = identity as IdentityPayload | undefined;
  const displayName =
    identityData?.fullName ??
    identityData?.nombre ??
    bundle?.user?.nombre ??
    "usuario";

  const openVacanciasDialog = () => {
    setVacanciasDialogData(null);
    setVacanciasDialogPage(1);
    setVacanciasDialogError(null);
    setVacanciasDialogOpen(true);
  };

  const vacanciasFilterValues = useMemo(
    () =>
      vacanciasTipoOperacionId
        ? { tipo_operacion_id: vacanciasTipoOperacionId }
        : {},
    [vacanciasTipoOperacionId],
  );

  const vacanciasFilterContext = useMemo(
    () =>
      ({
        displayedFilters: { tipo_operacion_id: true },
        filterValues: vacanciasFilterValues,
        hideFilter: noop,
        showFilter: noop,
        setFilters: (filters: Record<string, unknown>) => {
          const nextValue = filters?.tipo_operacion_id;
          const normalizedValue =
            nextValue == null || nextValue === "" ? undefined : String(nextValue);
          setVacanciasTipoOperacionId(normalizedValue);
          setVacanciasDialogData(null);
          setVacanciasDialogPage(1);
          setVacanciasDialogError(null);
          vacanciasLoadingMoreRef.current = false;
        },
      }) as any,
    [vacanciasFilterValues],
  );

  const vacanciasDetailItems = useMemo<PropiedadesDetailTableItem[]>(() => {
    if (!vacanciasDialogData?.data.length) {
      return [];
    }

    return vacanciasDialogData.data.map((item) => ({
      key: `${item.propiedad_id}-${item.vacancia_fecha ?? item.estado_fecha ?? "sin-fecha"}`,
      item,
      onClick: () => {
        saveHomeDashboardReturnMarker(returnTo, {
          savedAt: Date.now(),
          refreshKeys: normalizeHomeDashboardRefreshKeys(
            getRefreshKeysForItem("vacancias_prolongadas"),
          ),
        });
        setVacanciasDialogOpen(false);
        navigate(`/propiedades/${item.propiedad_id}?returnTo=${encodeURIComponent(returnTo)}`);
      },
    }));
  }, [navigate, returnTo, vacanciasDialogData]);

  const hasMoreVacancias =
    (vacanciasDialogData?.data.length ?? 0) < (vacanciasDialogData?.total ?? 0);

  useEffect(() => {
    const root = vacanciasViewportRef.current;
    const target = vacanciasLoadSentinelRef.current;

    if (!vacanciasDialogOpen || !root || !target || !hasMoreVacancias) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || vacanciasDialogLoading || vacanciasLoadingMoreRef.current) {
          return;
        }
        vacanciasLoadingMoreRef.current = true;
        setVacanciasDialogPage((current) => current + 1);
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
  }, [hasMoreVacancias, vacanciasDialogLoading, vacanciasDialogOpen, vacanciasDetailItems.length]);

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
    <div className="w-full space-y-3 pb-4 lg:max-w-[1320px]">
      <section className="p-1 sm:p-0">
        <div className="flex flex-col gap-2">
          <div className="space-y-1">
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

          </div>
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

      {isDesktopDashboardCards ? (
        <div className="grid min-w-0 gap-2 lg:grid-cols-[128px_minmax(0,1fr)_208px] lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[136px_minmax(0,1fr)_208px] 2xl:gap-3 2xl:grid-cols-[156px_minmax(0,1fr)_232px]">
          <section className="rounded-[18px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.96)_65%,rgba(243,244,246,0.96)_100%)] px-4 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)] lg:col-span-2 2xl:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <h2 className="text-[16px] font-semibold text-slate-950">¡Hola {displayName}!</h2>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 text-[11px] text-slate-500">Este es tu tablero operativo consolidado.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 cursor-pointer gap-1.5 rounded-md border border-transparent px-2 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-sm active:bg-slate-100"
                    onClick={() => {
                      clearHomeDashboardSnapshot(returnTo);
                      setIsRefreshing(true);
                      setReloadToken((current) => current + 1);
                    }}
                    disabled={isRefreshing}
                    title="Actualizar"
                    aria-label="Actualizar"
                    aria-busy={isRefreshing}
                  >
                    <RefreshCcw className={cn("h-3 w-3", isRefreshing ? "animate-spin" : "")} />
                    {isRefreshing ? "Actualizando" : "Actualizar"}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <DashboardSectionCard
            className="min-w-0 w-full gap-0 border-slate-200 bg-white py-0 shadow-[0_8px_18px_rgba(15,23,42,0.05)] lg:row-span-2"
            headerClassName="gap-1 border-b border-slate-100 px-4 pt-1.5 !pb-1.5 xl:pt-2 xl:!pb-2"
            contentClassName="space-y-1.5 px-4 py-1.5 xl:space-y-2 xl:py-2.5"
            title={<span className="text-sm font-semibold text-slate-950">Acciones rápidas</span>}
          >
            {HOME_QUICK_ACTIONS.map((action) => {
              const ActionIcon = getQuickActionIcon(action.key);

              return (
                <QuickActionButton
                  key={action.key}
                  label={action.label}
                  description={getQuickActionDescription(action.key)}
                  tone="light"
                  {...buildNavigationTarget(action.href, getRefreshKeysForQuickAction(action.key))}
                  icon={ActionIcon}
                />
              );
            })}
          </DashboardSectionCard>

          <DashboardSectionCard
            className={sectionCardClassName}
            headerClassName={sectionCardHeaderClassName}
            contentClassName={miDiaDesktopCardContentClassName}
            title={<span className="text-sm font-semibold text-slate-950">Mi dia</span>}
          >
            <MiDiaCompactContent
              items={bundle?.miDia.items ?? []}
              buildNavigationTarget={buildNavigationTarget}
              compact
            />
          </DashboardSectionCard>

          <DashboardSectionCard
            className={sectionCardClassName}
            headerClassName={sectionCardHeaderClassName}
            contentClassName={sectionCardContentClassName}
            title={<span className="text-sm font-semibold text-slate-950">Radar operacional</span>}
          >
            <RadarGroupedContent
              items={bundle?.radar.items ?? []}
              buildNavigationTarget={buildNavigationTarget}
              onOpenVacanciasDialog={openVacanciasDialog}
            />
          </DashboardSectionCard>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={["mi-dia"]} className="space-y-3">
          <HomeDashboardMobileSection
            value="mi-dia"
            title={<span className="text-sm font-semibold text-slate-950">Mi dia</span>}
            actions={
              bundle ? (
                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2 py-0 text-[10px]">
                  {formatCount(bundle.miDia.total)}
                </Badge>
              ) : null
            }
          >
            <MiDiaCompactContent
              items={bundle?.miDia.items ?? []}
              buildNavigationTarget={buildNavigationTarget}
            />
          </HomeDashboardMobileSection>

          <HomeDashboardMobileSection
            value="radar"
            title={<span className="text-sm font-semibold text-slate-950">Radar</span>}
          >
            <RadarGroupedContent
              items={bundle?.radar.items ?? []}
              buildNavigationTarget={buildNavigationTarget}
              onOpenVacanciasDialog={openVacanciasDialog}
            />
          </HomeDashboardMobileSection>

          <HomeDashboardMobileSection
            value="acciones"
            dark
            title={<span className="text-sm font-semibold text-white">Acciones</span>}
          >
            <div className="space-y-1.5">
              {HOME_QUICK_ACTIONS.map((action) => {
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
            </div>
          </HomeDashboardMobileSection>
        </Accordion>
      )}

      <Dialog open={vacanciasDialogOpen} onOpenChange={setVacanciasDialogOpen}>
        <DialogContent
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          className="max-w-[min(1100px,calc(100%-2rem))] gap-0 p-0"
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-sm font-medium text-primary"
                onClick={() => setVacanciasDialogOpen(false)}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Volver
              </Button>
              <DialogTitle className="text-left text-base">
                {buildPropiedadesDetailTitle("Vacancias prolongadas")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-left">
              Propiedades con vacancia activa por encima del umbral configurado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <ResourceContextProvider value="propiedades">
                <ListContextProvider value={vacanciasFilterContext}>
                  <FilterForm
                    filters={VACANCIAS_DIALOG_FILTERS}
                    formComponent={StyledFilterDiv}
                  />
                </ListContextProvider>
              </ResourceContextProvider>
            </div>

            {vacanciasDialogLoading && !vacanciasDetailItems.length ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-sm text-slate-500">
                Cargando detalle...
              </div>
            ) : null}

            {vacanciasDialogError ? (
              <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-4 text-sm text-red-700">
                {vacanciasDialogError}
              </div>
            ) : null}

            {!vacanciasDialogLoading && !vacanciasDialogError && !vacanciasDetailItems.length ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-sm text-slate-500">
                No hay propiedades con vacancia prolongada para mostrar.
              </div>
            ) : null}

            {vacanciasDetailItems.length ? (
              <div className="space-y-2">
                <div
                  ref={vacanciasViewportRef}
                  className="overflow-y-auto overscroll-y-contain pr-1"
                  style={{ height: PROP_DASHBOARD_DETAIL_VIEWPORT_HEIGHT }}
                >
                  <PropiedadesDetailTable
                    detailItems={vacanciasDetailItems}
                    showContratoColumn={false}
                    valueColumnLabel="Operacion"
                    valueColumnMode="tipoOperacion"
                    showActions={false}
                    storeKey="home-vacancias-prolongadas.datatable"
                  />
                  {hasMoreVacancias ? (
                    <div
                      ref={vacanciasLoadSentinelRef}
                      aria-hidden="true"
                      className="h-px w-full shrink-0 opacity-0"
                    />
                  ) : null}
                </div>

                {vacanciasDialogLoading ? (
                  <div className="text-center text-xs text-slate-500">Cargando mas...</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

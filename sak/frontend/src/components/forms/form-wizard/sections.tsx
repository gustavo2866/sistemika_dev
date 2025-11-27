import { ReactNode, useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type SectionCardProps = {
  title: string
  action?: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  active?: boolean
}

export const SectionCard = ({
  title,
  action,
  children,
  collapsible,
  defaultCollapsed,
  active,
}: SectionCardProps) => {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed))

  useEffect(() => {
    setCollapsed(Boolean(defaultCollapsed))
  }, [defaultCollapsed])

  const header = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((prev) => !prev)}
      className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <ChevronDown
        className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        aria-hidden="true"
      />
      {title}
    </button>
  ) : (
    <h5 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
  )

  return (
    <div
      className={cn(
        "w-full rounded-md border bg-white p-4 shadow-sm space-y-3 transition-colors",
        active ? "border-primary shadow-md" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {header}
        {action ? <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">{action}</div> : null}
      </div>
      {!collapsed ? children : null}
    </div>
  )
}

export type SummaryListProps = {
  items: { label: string; value: ReactNode }[]
}

export const SummaryList = ({ items }: SummaryListProps) => (
  <dl className="text-sm space-y-1">
    {items.map(({ label, value }) => (
      <div key={label} className="flex flex-wrap gap-2">
        <dt className="font-medium text-muted-foreground">{label}:</dt>
        <dd className="text-foreground">{value || "-"}</dd>
      </div>
    ))}
  </dl>
)

export type MessagePreviewProps = {
  referencia?: string
  asunto?: string | null
  contenido?: string | null
  contactName?: string
  resumenOportunidad?: string
  propiedadLabel?: string
  responsableTexto?: string
}

export const MessagePreview = ({
  referencia,
  asunto,
  contenido,
  contactName,
  resumenOportunidad,
  propiedadLabel,
  responsableTexto,
}: MessagePreviewProps) => {
  const [expanded, setExpanded] = useState(false)
  const texto = contenido || "Sin contenido"
  const needsExpand = texto.length > 240

  return (
    <div className="w-full rounded-md border bg-white p-4 shadow-sm space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          <span className="font-semibold">Referencia:</span> {referencia || "-"}
        </span>
        {contactName ? <span className="font-semibold">{contactName}</span> : null}
      </div>
      <div>
        <span className="font-semibold">Asunto:</span> {asunto || "(sin asunto)"}
      </div>
      {resumenOportunidad ? (
        <div>
          <span className="font-semibold">Oportunidad:</span> {resumenOportunidad}
        </div>
      ) : null}
      {propiedadLabel ? (
        <div>
          <span className="font-semibold">Propiedad:</span> {propiedadLabel}
        </div>
      ) : null}
      {responsableTexto ? (
        <div>
          <span className="font-semibold">Responsable:</span> {responsableTexto}
        </div>
      ) : null}
      <div className="border-t pt-2">
        <div className="font-semibold mb-1">Mensaje</div>
        <div
          className="whitespace-pre-wrap overflow-hidden"
          style={
            needsExpand && !expanded
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                }
              : undefined
          }
        >
          {texto}
        </div>
        {needsExpand ? (
          <button
            type="button"
            className="text-xs font-semibold text-primary underline"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Ver menos" : "... ver más"}
          </button>
        ) : null}
      </div>
    </div>
  )
}

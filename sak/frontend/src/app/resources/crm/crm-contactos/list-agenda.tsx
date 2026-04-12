"use client";

import { useMemo, useState } from "react";
import {
  useListContext,
  useRedirect,
  useDeleteWithUndoController,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/dataProvider";
import { Mail, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { List, LIST_CONTAINER_XS_CENTER } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import {
  ListPaginator,
  buildListFilters,
} from "@/components/forms/form_order";
import type { CRMContacto } from "./model";

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const AGENDA_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar contacto",
        alwaysOn: true,
        className: "w-full sm:w-[220px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "responsable_id",
        reference: "users",
        label: "Responsable",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-contactos-agenda" },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function groupByLetter(records: CRMContacto[]): [string, CRMContacto[]][] {
  const map = new Map<string, CRMContacto[]>();
  for (const r of records) {
    const key = (r.nombre_completo?.[0] ?? "#").toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Single contact row
// ---------------------------------------------------------------------------

const ContactoAgendaItem = ({ contact }: { contact: CRMContacto }) => {
  const redirect = useRedirect();
  const { isPending: isDeleting, handleDelete } = useDeleteWithUndoController({
    record: contact,
    resource: "crm/contactos",
    redirect: false,
  });

  const handleEdit = () => redirect("edit", "crm/contactos", contact.id);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors"
      onClick={handleEdit}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
          {getInitials(contact.nombre_completo)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug truncate">
          {contact.nombre_completo}
        </p>
        {contact.responsable_nombre && (
          <p className="text-xs text-muted-foreground truncate">
            {contact.responsable_nombre}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 mt-0.5">
          {contact.telefonos?.[0] && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              {contact.telefonos[0]}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Agenda body (consumes ListContext)
// ---------------------------------------------------------------------------

function fetchLetrasDisponibles(responsableId?: number | string, q?: string): Promise<string[]> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const params = new URLSearchParams();
  if (responsableId) params.set("responsable_id", String(responsableId));
  if (q) params.set("q", q);
  const qs = params.toString();
  return fetch(`${apiUrl}/crm/contactos/letras${qs ? `?${qs}` : ""}`, { headers }).then(
    (r) => (r.ok ? r.json() : []),
  );
}

const ContactoAgendaBody = () => {
  const {
    data = [],
    isLoading,
    filterValues,
    setFilters,
    displayedFilters,
  } = useListContext<CRMContacto>();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const grouped = useMemo(() => groupByLetter(data), [data]);

  const { data: availableLetters = [], isPending: letrasLoading } = useQuery<string[]>({
    queryKey: [
      "crm-contactos-letras",
      (filterValues as Record<string, unknown>).responsable_id ?? null,
      (filterValues as Record<string, unknown>).q ?? null,
    ],
    queryFn: () =>
      fetchLetrasDisponibles(
        (filterValues as Record<string, unknown>).responsable_id as number | undefined,
        (filterValues as Record<string, unknown>).q as string | undefined,
      ),
    staleTime: 2 * 60 * 1000,
  });
  const availableSet = useMemo(
    () => new Set(availableLetters),
    [availableLetters],
  );

  const handleLetterClick = (letter: string) => {
    const isActive = selectedLetter === letter;
    const newLetter = isActive ? null : letter;
    setSelectedLetter(newLetter);
     
    const { nombre_completo__startswith: _removed, ...rest } =
      filterValues as Record<string, unknown>;
    if (newLetter) {
      setFilters(
        { ...rest, nombre_completo__startswith: newLetter },
        displayedFilters,
      );
    } else {
      setFilters(rest, displayedFilters);
    }
  };

  const handleClearLetter = () => {
    if (!selectedLetter) return;
    setSelectedLetter(null);
     
    const { nombre_completo__startswith: _removed, ...rest } =
      filterValues as Record<string, unknown>;
    setFilters(rest, displayedFilters);
  };

  return (
    <>
      {/* Horizontal letter index bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex gap-0.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={handleClearLetter}
            className={cn(
              "shrink-0 h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
              !selectedLetter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            Todo
          </button>
          {ALPHABET.filter((l) => letrasLoading || availableSet.has(l)).map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => handleLetterClick(letter)}
              className={cn(
                "shrink-0 h-7 w-7 rounded-md text-xs font-medium transition-colors",
                selectedLetter === letter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Fixed-height scrollable list */}
      <div className="overflow-y-auto h-[calc(100dvh-14rem)]">
        {isLoading ? (
          <div className="flex flex-col">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-36 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !data.length ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Sin contactos
          </div>
        ) : (
          grouped.map(([letter, contacts]) => (
            <div key={letter}>
              {/* Section header */}
              <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-1.5 border-b">
                <span className="text-xs font-bold text-muted-foreground tracking-wider">
                  {letter}
                </span>
              </div>
              {/* Items */}
              {contacts.map((contact, idx) => (
                <div key={contact.id}>
                  <ContactoAgendaItem contact={contact} />
                  {idx < contacts.length - 1 && (
                    <Separator className="ml-[64px]" />
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
};
// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export const CRMContactoListAgenda = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  return (
    <List
      title="Contactos"
      filters={AGENDA_FILTERS}
      actions={
        <div className="flex items-center gap-2">
          <FilterButton
            filters={AGENDA_FILTERS}
            size="sm"
            buttonClassName="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
          />
          <CreateButton
            className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
            label="Crear"
          />
        </div>
      }
      debounce={300}
      perPage={100}
      sort={{ field: "nombre_completo", order: "ASC" }}
      containerClassName={LIST_CONTAINER_XS_CENTER}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      pagination={<ListPaginator />}
    >
      <ContactoAgendaBody />
    </List>
  );
};

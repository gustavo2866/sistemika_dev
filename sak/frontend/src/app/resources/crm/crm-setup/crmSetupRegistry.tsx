"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  CRMCelularCreate,
  CRMCelularEdit,
  CRMCelularList,
} from "@/app/resources/crm/crm-celulares";
import {
  CRMCondicionPagoCreate,
  CRMCondicionPagoEdit,
  CRMCondicionPagoList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-condiciones-pago";
import {
  CRMMotivoEventoCreate,
  CRMMotivoEventoEdit,
  CRMMotivoEventoList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-motivos-evento";
import {
  CRMMotivoPerdidaCreate,
  CRMMotivoPerdidaEdit,
  CRMMotivoPerdidaList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-motivos-perdida";
import {
  CRMCatalogoRespuestaCreate,
  CRMCatalogoRespuestaEdit,
  CRMCatalogoRespuestaList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-respuestas";
import {
  CRMTipoEventoCreate,
  CRMTipoEventoEdit,
  CRMTipoEventoList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-tipos-evento";
import {
  CRMTipoOperacionCreate,
  CRMTipoOperacionEdit,
  CRMTipoOperacionList,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-tipos-operacion";
import {
  MonedaCreate,
  MonedaEdit,
  MonedaList,
} from "@/app/resources/configuracion/monedas";
import { CRMChatAgentSettingsPanel } from "./CRMChatAgentSettingsPanel";

// Define las opciones disponibles del workspace de configuracion CRM.
export const CRM_SETUP_ITEMS: SetupItem[] = [
  {
    key: "tipos-operacion",
    label: "Tipos de operacion",
    description: "Administrar pipeline y operaciones disponibles.",
    resource: "crm/catalogos/tipos-operacion",
    listComponent: CRMTipoOperacionList,
    createComponent: CRMTipoOperacionCreate,
    editComponent: CRMTipoOperacionEdit,
  },
  {
    key: "motivos-perdida",
    label: "Motivos de perdida",
    description: "Razones para registrar oportunidades perdidas.",
    resource: "crm/catalogos/motivos-perdida",
    listComponent: CRMMotivoPerdidaList,
    createComponent: CRMMotivoPerdidaCreate,
    editComponent: CRMMotivoPerdidaEdit,
  },
  {
    key: "condiciones-pago",
    label: "Condiciones de pago",
    description: "Terminos de cobro y financiacion ofrecidos.",
    resource: "crm/catalogos/condiciones-pago",
    listComponent: CRMCondicionPagoList,
    createComponent: CRMCondicionPagoCreate,
    editComponent: CRMCondicionPagoEdit,
  },
  {
    key: "tipos-evento",
    label: "Tipos de evento",
    description: "Clasificaciones de actividades comerciales.",
    resource: "crm/catalogos/tipos-evento",
    listComponent: CRMTipoEventoList,
    createComponent: CRMTipoEventoCreate,
    editComponent: CRMTipoEventoEdit,
  },
  {
    key: "motivos-evento",
    label: "Motivos de evento",
    description: "Disparadores o resultados de cada evento.",
    resource: "crm/catalogos/motivos-evento",
    listComponent: CRMMotivoEventoList,
    createComponent: CRMMotivoEventoCreate,
    editComponent: CRMMotivoEventoEdit,
  },
  {
    key: "respuestas",
    label: "Respuestas",
    description: "Respuestas rapidas para el equipo.",
    resource: "crm/catalogos/respuestas",
    listComponent: CRMCatalogoRespuestaList,
    createComponent: CRMCatalogoRespuestaCreate,
    editComponent: CRMCatalogoRespuestaEdit,
  },
  {
    key: "celulares",
    label: "Celulares",
    description: "Lineas y canales moviles integrados al modulo CRM.",
    resource: "crm/celulares",
    listComponent: CRMCelularList,
    createComponent: CRMCelularCreate,
    editComponent: CRMCelularEdit,
  },
  {
    key: "agente-chat",
    label: "Agente de chat",
    description: "Configura la modalidad global del agente que procesa mensajes entrantes.",
    customComponent: CRMChatAgentSettingsPanel,
  },
  {
    key: "monedas",
    label: "Monedas",
    description: "Monedas disponibles para cotizaciones y operaciones.",
    resource: "monedas",
    listComponent: MonedaList,
    createComponent: MonedaCreate,
    editComponent: MonedaEdit,
  },
];

// Busca una opcion del setup a partir de su clave de navegacion.
export const getCRMSetupItem = (key?: string | null) =>
  CRM_SETUP_ITEMS.find((item) => item.key === key);

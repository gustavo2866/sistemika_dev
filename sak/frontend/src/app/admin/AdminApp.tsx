"use client";

import { Admin } from "@/components/admin";
import type { DataProvider } from "ra-core";
import { Resource, CustomRoutes } from "ra-core";
import { Route } from "react-router-dom";
import {
  Users,
  FileText,
  Building2,
  Workflow,
  CreditCard,
  Receipt,
  Home,
  Package,
  ClipboardList,
  Kanban,
  Truck,
  BarChart3,
  ShoppingCart,
  ClipboardCheck,
  Wallet,
  NotebookPen,
  FileStack,
  Building,
  Coins,
  BarChart2,
  GitBranch,
  AlertTriangle,
  CalendarDays,
  ListChecks,
  Mail,
  LineChart,
  Target,
  CalendarCheck,
  UserRound,
  Factory,
  HandCoins,
  MessageCircle,
} from "lucide-react";
import { dataProvider } from "@/lib/dataProvider";
import { authProvider } from "@/lib/authProvider";
import { UserList, UserCreate, UserEdit, UserShow } from "@/app/resources/users";
import { TipoComprobanteList, TipoComprobanteCreate, TipoComprobanteEdit, TipoComprobanteShow } from "@/app/resources/tipos-comprobante";
import { MetodoPagoList, MetodoPagoCreate, MetodoPagoEdit, MetodoPagoShow } from "@/app/resources/metodos-pago";
import { ArticuloList, ArticuloCreate, ArticuloEdit, ArticuloShow } from "@/app/resources/articulos";
import { PropiedadList, PropiedadCreate, PropiedadEdit, PropiedadShow } from "@/app/resources/propiedades";
import {
  TipoPropiedadList,
  TipoPropiedadCreate,
  TipoPropiedadEdit,
  TipoPropiedadShow,
} from "@/app/resources/tipos-propiedad";
import {
  FacturaList,
  FacturaCreate,
  FacturaEdit,
  FacturaShow,
} from "@/app/resources/facturas";
import {
  ProveedorList,
  ProveedorCreate,
  ProveedorEdit,
  ProveedorShow,
} from "@/app/resources/proveedores";
import {
  TipoOperacionList,
  TipoOperacionCreate,
  TipoOperacionEdit,
  TipoOperacionShow,
} from "@/app/resources/tipos-operacion";
import {
  ProyectoList,
  ProyectoCreate,
  ProyectoEdit,
  ProyectoShow,
} from "@/app/resources/proyectos";
import {
  SolicitudList,
  SolicitudCreate,
  SolicitudEdit,
} from "@/app/resources/solicitudes";
import {
  DepartamentoList,
  DepartamentoCreate,
  DepartamentoEdit,
} from "@/app/resources/departamentos";
import {
  CentroCostoList,
  CentroCostoCreate,
  CentroCostoEdit,
  CentroCostoShow,
} from "@/app/resources/centros-costo";
import {
  TipoSolicitudList,
  TipoSolicitudCreate,
  TipoSolicitudEdit,
} from "@/app/resources/tipos-solicitud";
import RecepcionesList from "@/app/resources/recepciones/list";
import DashboardProyectosList from "@/app/resources/dashboard-proyectos/list";
import DashboardVacanciasList from "@/app/resources/dashboard-vacancias/list";
import DashboardCrmList from "@/app/resources/dashboard-crm/list";
import OrdenCompraList from "@/app/resources/orden-compra/list";
import TarjasList from "@/app/resources/tarjas/list";
import { VacanciaList, VacanciaShow } from "@/app/resources/vacancias";
import {
  NominaList,
  NominaCreate,
  NominaEdit,
  NominaShow,
} from "@/app/resources/nomina";
import {
  ParteDiarioList,
  ParteDiarioCreate,
  ParteDiarioEdit,
  ParteDiarioShow,
} from "@/app/resources/parte-diario";
import {
  CRMTipoOperacionList,
  CRMTipoOperacionCreate,
  CRMTipoOperacionEdit,
  CRMTipoOperacionShow,
} from "@/app/resources/crm-catalogos/crm-catalogos-tipos-operacion";
import {
  CRMMotivoPerdidaList,
  CRMMotivoPerdidaCreate,
  CRMMotivoPerdidaEdit,
  CRMMotivoPerdidaShow,
} from "@/app/resources/crm-catalogos/crm-catalogos-motivos-perdida";
import {
  CRMCondicionPagoList,
  CRMCondicionPagoCreate,
  CRMCondicionPagoEdit,
  CRMCondicionPagoShow,
} from "@/app/resources/crm-catalogos/crm-catalogos-condiciones-pago";
import {
  CRMTipoEventoList,
  CRMTipoEventoCreate,
  CRMTipoEventoEdit,
  CRMTipoEventoShow,
} from "@/app/resources/crm-catalogos/crm-catalogos-tipos-evento";
import {
  CRMMotivoEventoList,
  CRMMotivoEventoCreate,
  CRMMotivoEventoEdit,
  CRMMotivoEventoShow,
} from "@/app/resources/crm-catalogos/crm-catalogos-motivos-evento";
import {
  MonedaList,
  MonedaCreate,
  MonedaEdit,
  MonedaShow,
} from "@/app/resources/monedas";
import {
  CRMCotizacionList,
  CRMCotizacionCreate,
  CRMCotizacionEdit,
  CRMCotizacionShow,
} from "@/app/resources/crm-cotizaciones";
import {
  CRMContactoList,
  CRMContactoCreate,
  CRMContactoEdit,
  CRMContactoShow,
} from "@/app/resources/crm-contactos";
import {
  CRMOportunidadList,
  CRMOportunidadCreate,
  CRMOportunidadEdit,
  CRMOportunidadShow,
  CRMOportunidadPanelPage,
} from "@/app/resources/crm-oportunidades";
import { CRMOportunidadPanelEdit } from "@/app/resources/crm-panel/edit";
import { CRMOportunidadAccionCotizar } from "@/app/resources/crm-panel/accion_cotizar";
import { CRMOportunidadAccionAgendar } from "@/app/resources/crm-panel/accion_agendar";
import { CRMOportunidadAccionCerrar } from "@/app/resources/crm-panel/accion_cerrar";
import { CRMOportunidadAccionDescartar } from "@/app/resources/crm-panel/accion_descartar";
import { CRMOportunidadAccionAceptar } from "@/app/resources/crm-panel/accion_aceptar";
import {
  CRMEventoList,
  CRMEventoCreate,
  CRMEventoEdit,
  CRMEventoShow,
} from "@/app/resources/crm-eventos";
import { CRMChatList, CRMChatShow } from "@/app/resources/crm-chat";
import {
  CRMMensajeList,
  CRMMensajeCreate,
  CRMMensajeEdit,
  CRMMensajeShow,
} from "@/app/resources/crm-mensajes";
import { CRMMensajeReply } from "@/app/resources/crm-mensajes/form_responder";
import {
  EmprendimientoList,
  EmprendimientoCreate,
  EmprendimientoEdit,
  EmprendimientoShow,
} from "@/app/resources/emprendimientos";
import { CRMSetupPage } from "@/app/resources/crm-setup/CRMSetupPage";

declare const window: Window | undefined;

const AdminApp = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <Admin
      requireAuth
      dataProvider={dataProvider as DataProvider}
      authProvider={authProvider}
      title="WCL"
    >
      <Resource
        name="users"
        list={UserList}
        create={UserCreate}
        edit={UserEdit}
        show={UserShow}
        recordRepresentation="nombre"
        icon={Users}
      />
      <Resource
        name="tipos-comprobante"
        list={TipoComprobanteList}
        create={TipoComprobanteCreate}
        edit={TipoComprobanteEdit}
        show={TipoComprobanteShow}
        recordRepresentation="name"
        icon={Receipt}
      />
      <Resource
        name="facturas"
        list={FacturaList}
        create={FacturaCreate}
        edit={FacturaEdit}
        show={FacturaShow}
        recordRepresentation="numero"
        icon={FileText}
      />
      <Resource
        name="proveedores"
        list={ProveedorList}
        create={ProveedorCreate}
        edit={ProveedorEdit}
        show={ProveedorShow}
        recordRepresentation="nombre"
        icon={Building2}
      />
      <Resource
        name="metodos-pago"
        list={MetodoPagoList}
        create={MetodoPagoCreate}
        edit={MetodoPagoEdit}
        show={MetodoPagoShow}
        recordRepresentation="nombre"
        icon={CreditCard}
      />
      <Resource
        name="proyectos"
        list={ProyectoList}
        create={ProyectoCreate}
        edit={ProyectoEdit}
        show={ProyectoShow}
        recordRepresentation="nombre"
        icon={Kanban}
        options={{ label: "Proyectos" }}
      />
      <Resource
        name="articulos"
        list={ArticuloList}
        create={ArticuloCreate}
        edit={ArticuloEdit}
        show={ArticuloShow}
        recordRepresentation="nombre"
        icon={Package}
      />
      <Resource
        name="propiedades"
        list={PropiedadList}
        create={PropiedadCreate}
        edit={PropiedadEdit}
        show={PropiedadShow}
        recordRepresentation="nombre"
        icon={Home}
      />
      <Resource
        name="vacancias"
        list={VacanciaList}
        show={VacanciaShow}
        recordRepresentation="id"
        icon={AlertTriangle}
        options={{ label: "Vacancias" }}
      />
      <Resource
        name="tipos-propiedad"
        list={TipoPropiedadList}
        create={TipoPropiedadCreate}
        edit={TipoPropiedadEdit}
        show={TipoPropiedadShow}
        recordRepresentation="nombre"
        icon={Building}
        options={{ label: "Tipos de Propiedad" }}
      />
      <Resource
        name="tipos-operacion"
        list={TipoOperacionList}
        create={TipoOperacionCreate}
        edit={TipoOperacionEdit}
        show={TipoOperacionShow}
        recordRepresentation="descripcion"
        icon={Workflow}
      />
      <Resource
        name="departamentos"
        list={DepartamentoList}
        create={DepartamentoCreate}
        edit={DepartamentoEdit}
        recordRepresentation="nombre"
        icon={Building}
        options={{ label: "Departamentos" }}
      />
      <Resource
        name="centros-costo"
        list={CentroCostoList}
        create={CentroCostoCreate}
        edit={CentroCostoEdit}
        show={CentroCostoShow}
        recordRepresentation="nombre"
        icon={Coins}
        options={{ label: "Centros de Costo" }}
      />
      <Resource
        name="tipos-solicitud"
        list={TipoSolicitudList}
        create={TipoSolicitudCreate}
        edit={TipoSolicitudEdit}
        recordRepresentation="nombre"
        icon={FileStack}
        options={{ label: "Tipos de Solicitud" }}
      />
      <Resource
        name="solicitudes"
        list={SolicitudList}
        create={SolicitudCreate}
        edit={SolicitudEdit}
        recordRepresentation="id"
        icon={ClipboardList}
        options={{ label: "Solicitudes" }}
      />
      <Resource
        name="recepciones"
        list={RecepcionesList}
        recordRepresentation="id"
        icon={Truck}
        options={{ label: "Recepciones" }}
      />
      <Resource
        name="dashboard-proyectos"
        list={DashboardProyectosList}
        recordRepresentation="id"
        icon={BarChart3}
        options={{ label: "Dashboard" }}
      />
      <Resource
        name="dashboard-vacancias"
        list={DashboardVacanciasList}
        recordRepresentation="id"
        icon={BarChart2}
        options={{ label: "Dashboard Vacancias" }}
      />
      <Resource
        name="dashboard-crm"
        list={DashboardCrmList}
        recordRepresentation="id"
        icon={LineChart}
        options={{ label: "CRM Dashboard" }}
      />
      <Resource
        name="orden-compra"
        list={OrdenCompraList}
        recordRepresentation="id"
        icon={ShoppingCart}
        options={{ label: "Orden de Compra" }}
      />
      <Resource
        name="tarjas"
        list={TarjasList}
        recordRepresentation="id"
        icon={ClipboardCheck}
        options={{ label: "Tarjas" }}
      />
      <Resource
        name="parte-diario"
        list={ParteDiarioList}
        create={ParteDiarioCreate}
        edit={ParteDiarioEdit}
        show={ParteDiarioShow}
        recordRepresentation="descripcion"
        icon={NotebookPen}
        options={{ label: "Parte Diario" }}
      />
      <Resource
        name="nominas"
        list={NominaList}
        create={NominaCreate}
        edit={NominaEdit}
        show={NominaShow}
        recordRepresentation="nombre"
        icon={Wallet}
        options={{ label: "Nómina" }}
      />
      <Resource
        name="crm/catalogos/tipos-operacion"
        list={CRMTipoOperacionList}
        create={CRMTipoOperacionCreate}
        edit={CRMTipoOperacionEdit}
        show={CRMTipoOperacionShow}
        recordRepresentation="nombre"
        icon={GitBranch}
        options={{ label: "CRM · Tipos de Operación" }}
      />
      <Resource
        name="crm/catalogos/motivos-perdida"
        list={CRMMotivoPerdidaList}
        create={CRMMotivoPerdidaCreate}
        edit={CRMMotivoPerdidaEdit}
        show={CRMMotivoPerdidaShow}
        recordRepresentation="nombre"
        icon={AlertTriangle}
        options={{ label: "CRM · Motivos de Pérdida" }}
      />
      <Resource
        name="crm/catalogos/condiciones-pago"
        list={CRMCondicionPagoList}
        create={CRMCondicionPagoCreate}
        edit={CRMCondicionPagoEdit}
        show={CRMCondicionPagoShow}
        recordRepresentation="nombre"
        icon={HandCoins}
        options={{ label: "CRM · Condiciones de Pago" }}
      />
      <Resource
        name="crm/catalogos/tipos-evento"
        list={CRMTipoEventoList}
        create={CRMTipoEventoCreate}
        edit={CRMTipoEventoEdit}
        show={CRMTipoEventoShow}
        recordRepresentation="nombre"
        icon={CalendarDays}
        options={{ label: "CRM · Tipos de Evento" }}
      />
      <Resource
        name="crm/catalogos/motivos-evento"
        list={CRMMotivoEventoList}
        create={CRMMotivoEventoCreate}
        edit={CRMMotivoEventoEdit}
        show={CRMMotivoEventoShow}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "CRM · Motivos de Evento" }}
      />
      <Resource
        name="monedas"
        list={MonedaList}
        create={MonedaCreate}
        edit={MonedaEdit}
        show={MonedaShow}
        recordRepresentation="nombre"
        icon={Coins}
        options={{ label: "CRM · Monedas" }}
      />
      <Resource
        name="crm/cotizaciones"
        list={CRMCotizacionList}
        create={CRMCotizacionCreate}
        edit={CRMCotizacionEdit}
        show={CRMCotizacionShow}
        recordRepresentation="id"
        icon={LineChart}
        options={{ label: "CRM · Cotizaciones" }}
      />
      <Resource
        name="crm/contactos"
        list={CRMContactoList}
        create={CRMContactoCreate}
        edit={CRMContactoEdit}
        show={CRMContactoShow}
        recordRepresentation="nombre_completo"
        icon={UserRound}
        options={{ label: "CRM · Contactos" }}
      />
      <Resource
        name="crm/oportunidades"
        list={CRMOportunidadList}
        create={CRMOportunidadCreate}
        edit={CRMOportunidadEdit}
        show={CRMOportunidadShow}
        recordRepresentation="id"
        icon={Target}
        options={{ label: "CRM · Oportunidades" }}
      />
      <Resource
        name="crm/eventos"
        list={CRMEventoList}
        create={CRMEventoCreate}
        edit={CRMEventoEdit}
        show={CRMEventoShow}
        recordRepresentation="id"
        icon={CalendarCheck}
        options={{ label: "CRM · Eventos" }}
      />
      <Resource
        name="crm/chat"
        list={CRMChatList}
        show={CRMChatShow}
        recordRepresentation="id"
        icon={MessageCircle}
        options={{ label: "CRM - Chat" }}
      />
      <Resource
        name="crm/mensajes"
        list={CRMMensajeList}
        create={CRMMensajeCreate}
        edit={CRMMensajeEdit}
        show={CRMMensajeShow}
        recordRepresentation="asunto"
        icon={Mail}
        options={{ label: "CRM - Mensajes" }}
      />
      <Resource
        name="emprendimientos"
        list={EmprendimientoList}
        create={EmprendimientoCreate}
        edit={EmprendimientoEdit}
        show={EmprendimientoShow}
        recordRepresentation="nombre"
        icon={Factory}
        options={{ label: "Emprendimientos" }}
      />
      <CustomRoutes>
        <Route path="/solicitudes/create-mb" element={<SolicitudCreate />} />
        <Route path="/solicitudes/:id/edit-mb" element={<SolicitudEdit />} />
        <Route path="/crm/setup" element={<CRMSetupPage />} />
        <Route path="/crm/panel" element={<CRMOportunidadPanelPage />} />
        <Route path="/crm/panel/:id/edit" element={<CRMOportunidadPanelEdit />} />
        <Route path="/crm/panel/:id/accion_cotizar" element={<CRMOportunidadAccionCotizar />} />
        <Route path="/crm/panel/:id/accion_agendar" element={<CRMOportunidadAccionAgendar />} />
        <Route path="/crm/panel/:id/accion_cerrar" element={<CRMOportunidadAccionCerrar />} />
        <Route path="/crm/panel/:id/accion_descartar" element={<CRMOportunidadAccionDescartar />} />
        <Route path="/crm/panel/:id/accion_aceptar" element={<CRMOportunidadAccionAceptar />} />
        <Route path="/crm/mensajes/:id/responder" element={<CRMMensajeReply />} />
      </CustomRoutes>
    </Admin>
  );
};

export default AdminApp;


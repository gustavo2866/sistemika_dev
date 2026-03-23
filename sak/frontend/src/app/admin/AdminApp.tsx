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
  Phone,
  Settings,
  ClipboardList,
} from "lucide-react";
import { dataProvider } from "@/lib/dataProvider";
import { authProvider } from "@/lib/authProvider";
import { UserList, UserCreate, UserEdit, UserShow } from "@/app/resources/configuracion/users";
import { TipoComprobanteList, TipoComprobanteCreate, TipoComprobanteEdit, TipoComprobanteShow } from "@/app/resources/po/tipos-comprobante";
import { MetodoPagoList, MetodoPagoCreate, MetodoPagoEdit, MetodoPagoShow } from "@/app/resources/configuracion/metodos-pago";
import { ArticuloList, ArticuloCreate, ArticuloEdit, ArticuloShow } from "@/app/resources/po/articulos";
import {
  TipoArticuloList,
  TipoArticuloCreate,
  TipoArticuloEdit,
} from "@/app/resources/po/tipos-articulo";
import {
  AdmConceptoList,
  AdmConceptoCreate,
  AdmConceptoEdit,
  AdmConceptoShow,
} from "@/app/resources/administracion/adm-conceptos";
import {
  TaxProfileList,
  TaxProfileCreate,
  TaxProfileEdit,
  TaxProfileShow,
} from "@/app/resources/configuracion/tax-profiles";
import {
  PropiedadesStatusList,
  PropiedadesStatusCreate,
  PropiedadesStatusEdit,
} from "@/app/resources/inmobiliaria/propiedades-status";
import {
  PropiedadCreate,
  PropiedadEdit,
  PropiedadShow,
  PropiedadesPanel,
} from "@/app/resources/inmobiliaria/propiedades";
import {
  PropietarioList,
  PropietarioCreate,
  PropietarioEdit,
  PropietarioShow,
} from "@/app/resources/inmobiliaria/propietarios";
import {
  TipoActualizacionList,
  TipoActualizacionCreate,
  TipoActualizacionEdit,
  TipoActualizacionShow,
} from "@/app/resources/inmobiliaria/tipos-actualizacion";
import { PropiedadesLogStatusList } from "@/app/resources/inmobiliaria/propiedades_log_status";
import {
  TipoPropiedadList,
  TipoPropiedadCreate,
  TipoPropiedadEdit,
  TipoPropiedadShow,
} from "@/app/resources/inmobiliaria/tipos-propiedad";
import {
  FacturaList,
  FacturaCreate,
  FacturaEdit,
  FacturaShow,
} from "@/app/resources/administracion/facturas";
import {
  ProveedorList,
  ProveedorCreate,
  ProveedorEdit,
  ProveedorShow,
} from "@/app/resources/po/proveedores";
import {
  TipoOperacionList,
  TipoOperacionCreate,
  TipoOperacionEdit,
  TipoOperacionShow,
} from "@/app/resources/configuracion/tipos-operacion";
import {
  ProyectoList,
  ProyectoCreate,
  ProyectoEdit,
  ProyectoShow,
} from "@/app/resources/constructora/proyectos";
import {
  ProyFaseList,
  ProyFaseCreate,
  ProyFaseEdit,
} from "@/app/resources/constructora/proy-fases";
import {
  PoOrderList,
  PoOrderCreate,
  PoOrderEdit,
  PoOrderShow,
} from "@/app/resources/po/po-orders";
import { PoDashboardList } from "@/app/resources/po/po-dashboard";
import { PoOrdersApprovalList } from "@/app/resources/po/po-orders-approval";
import {
  PoInvoiceList,
  PoInvoiceAgendaList,
  PoInvoiceCreate,
  PoInvoiceEdit,
  PoInvoiceShow,
} from "@/app/resources/po/po-invoices";
import {
  PoOrderStatusList,
  PoOrderStatusCreate,
  PoOrderStatusEdit,
} from "@/app/resources/po/po-order-status";
import {
  PoInvoiceStatusList,
  PoInvoiceStatusCreate,
  PoInvoiceStatusEdit,
} from "@/app/resources/po/po-invoice-status";
import {
  PoInvoiceStatusFinList,
  PoInvoiceStatusFinCreate,
  PoInvoiceStatusFinEdit,
} from "@/app/resources/po/po-invoice-status-fin";
import {
  DepartamentoList,
  DepartamentoCreate,
  DepartamentoEdit,
} from "@/app/resources/po/departamentos";
import {
  CentroCostoList,
  CentroCostoCreate,
  CentroCostoEdit,
  CentroCostoShow,
} from "@/app/resources/administracion/centros-costo";
import {
  TipoSolicitudList,
  TipoSolicitudCreate,
  TipoSolicitudEdit,
} from "@/app/resources/configuracion/tipos-solicitud";
import RecepcionesList from "@/app/resources/constructora/recepciones/list";
import DashboardProyectosList from "@/app/resources/constructora/dashboard-proyectos/list";
import DashboardCrmList from "@/app/resources/crm/crm-dashboard/list";
import TarjasList from "@/app/resources/constructora/tarjas/list";
import {
  NominaList,
  NominaCreate,
  NominaEdit,
  NominaShow,
} from "@/app/resources/administracion/nomina";
import {
  ParteDiarioList,
  ParteDiarioCreate,
  ParteDiarioEdit,
  ParteDiarioShow,
} from "@/app/resources/constructora/parte-diario";
import {
  CRMTipoOperacionList,
  CRMTipoOperacionCreate,
  CRMTipoOperacionEdit,
  CRMTipoOperacionShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-tipos-operacion";
import {
  CRMMotivoPerdidaList,
  CRMMotivoPerdidaCreate,
  CRMMotivoPerdidaEdit,
  CRMMotivoPerdidaShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-motivos-perdida";
import {
  CRMCondicionPagoList,
  CRMCondicionPagoCreate,
  CRMCondicionPagoEdit,
  CRMCondicionPagoShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-condiciones-pago";
import {
  CRMTipoEventoList,
  CRMTipoEventoCreate,
  CRMTipoEventoEdit,
  CRMTipoEventoShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-tipos-evento";
import {
  CRMMotivoEventoList,
  CRMMotivoEventoCreate,
  CRMMotivoEventoEdit,
  CRMMotivoEventoShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-motivos-evento";
import {
  CRMCatalogoRespuestaList,
  CRMCatalogoRespuestaCreate,
  CRMCatalogoRespuestaEdit,
  CRMCatalogoRespuestaShow,
} from "@/app/resources/crm/crm-catalogos/crm-catalogos-respuestas";
import { CalculadoraFinanciera } from "@/app/resources/inmobiliaria/calculadora-financiera";
import HomeDashboard from "@/app/resources/home/HomeDashboard";
import {
  MonedaList,
  MonedaCreate,
  MonedaEdit,
  MonedaShow,
} from "@/app/resources/configuracion/monedas";
import {
  CRMContactoList,
  CRMContactoListAgenda,
  CRMContactoCreate,
  CRMContactoEdit,
  CRMContactoShow,
} from "@/app/resources/crm/crm-contactos";
import {
  CRMOportunidadList,
  CRMOportunidadCreate,
  CRMOportunidadEdit,
  CRMOportunidadShow,
} from "@/app/resources/crm/crm-oportunidades";
import { CRMOportunidadPanelPage } from "@/app/resources/crm/crm-panel/list-panel";
import { CRMOportunidadAccionCotizar } from "@/app/resources/crm/crm-oportunidades/accion_cotizar";
import { CRMOportunidadAccionReservar } from "@/app/resources/crm/crm-oportunidades/accion_reservar";
import { CRMOportunidadAccionAgendar } from "@/app/resources/crm/crm-oportunidades/accion_agendar";
import { CRMOportunidadAccionCerrar } from "@/app/resources/crm/crm-oportunidades/accion_cerrar";
import { CRMOportunidadAccionDescartar } from "@/app/resources/crm/crm-oportunidades/accion_descartar";
import { CRMOportunidadAccionAceptar } from "@/app/resources/crm/crm-oportunidades/accion_aceptar";
import {
  CRMEventoList,
  CRMEventoCreate,
  CRMEventoEdit,
  CRMEventoShow,
} from "@/app/resources/crm/crm-eventos";
import {
  CRMCelularList,
  CRMCelularCreate,
  CRMCelularEdit,
  CRMCelularShow,
} from "@/app/resources/crm/crm-celulares";
import { CRMChatList, CRMChatShow } from "@/app/resources/crm/crm-chat";
import {
  CRMMensajeList,
  CRMMensajeCreate,
  CRMMensajeEdit,
  CRMMensajeShow,
} from "@/app/resources/crm/crm-mensajes";
import { CRMMensajeReply } from "@/app/resources/crm/crm-mensajes/form_responder";
import { CRMAdminPage } from "@/app/resources/crm/crm-admin/CRMAdminPage";
import {
  EmprendimientoList,
  EmprendimientoCreate,
  EmprendimientoEdit,
  EmprendimientoShow,
} from "@/app/resources/inmobiliaria/emprendimientos";
import { CRMSetupPage } from "@/app/resources/crm/crm-setup/CRMSetupPage";
import { PoSetupPage } from "@/app/resources/po/po-setup/PoSetupPage";
import { InmobiliariaSetupPage } from "@/app/resources/inmobiliaria/inmobiliaria-setup-page";

declare const window: Window | undefined;

const AgendaPagosIcon = (props: { className?: string }) => (
  <CalendarDays className={`h-4 w-4 text-rose-600 ${props.className ?? ""}`} />
);

const AdminApp = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <Admin
      requireAuth
      dataProvider={dataProvider as DataProvider}
      authProvider={authProvider}
      dashboard={HomeDashboard}
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
        name="api/v1/adm/conceptos"
        list={AdmConceptoList}
        create={AdmConceptoCreate}
        edit={AdmConceptoEdit}
        show={AdmConceptoShow}
        recordRepresentation="nombre"
        icon={FileText}
        options={{ label: "Conceptos" }}
      />
      <Resource
        name="api/v1/tax-profiles"
        list={TaxProfileList}
        create={TaxProfileCreate}
        edit={TaxProfileEdit}
        show={TaxProfileShow}
        recordRepresentation="nombre"
        icon={Coins}
        options={{ label: "Perfiles de Impuestos" }}
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
        name="proy-fases"
        list={ProyFaseList}
        create={ProyFaseCreate}
        edit={ProyFaseEdit}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Fases de Proyecto" }}
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
        name="tipos-articulo"
        list={TipoArticuloList}
        create={TipoArticuloCreate}
        edit={TipoArticuloEdit}
        recordRepresentation="nombre"
        icon={Package}
        options={{ label: "Tipos de Articulo" }}
      />
      <Resource
        name="propiedades-status"
        list={PropiedadesStatusList}
        create={PropiedadesStatusCreate}
        edit={PropiedadesStatusEdit}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Estados de Propiedad" }}
      />
      <Resource
        name="propiedades"
        list={PropiedadesPanel}
        create={PropiedadCreate}
        edit={PropiedadEdit}
        show={PropiedadShow}
        recordRepresentation="nombre"
        icon={Home}
        options={{ label: "Propiedades Panel" }}
      />
      <Resource
        name="propiedades-log-status"
        list={PropiedadesLogStatusList}
        recordRepresentation="id"
        icon={ListChecks}
        options={{ label: "Log Estados Propiedad" }}
      />
      <Resource
        name="propietarios"
        list={PropietarioList}
        create={PropietarioCreate}
        edit={PropietarioEdit}
        show={PropietarioShow}
        recordRepresentation="nombre"
        icon={UserRound}
        options={{ label: "Propietarios" }}
      />
      <Resource
        name="tipos-actualizacion"
        list={TipoActualizacionList}
        create={TipoActualizacionCreate}
        edit={TipoActualizacionEdit}
        show={TipoActualizacionShow}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Tipos de actualizacion" }}
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
        name="po-order-status"
        list={PoOrderStatusList}
        create={PoOrderStatusCreate}
        edit={PoOrderStatusEdit}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Estados de Orden" }}
      />
      <Resource
        name="po-invoice-status"
        list={PoInvoiceStatusList}
        create={PoInvoiceStatusCreate}
        edit={PoInvoiceStatusEdit}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Estados de Factura OC" }}
      />
      <Resource
        name="po-invoice-status-fin"
        list={PoInvoiceStatusFinList}
        create={PoInvoiceStatusFinCreate}
        edit={PoInvoiceStatusFinEdit}
        recordRepresentation="nombre"
        icon={ListChecks}
        options={{ label: "Estados Financieros Factura OC" }}
      />
      <Resource
        name="po-dashboard"
        list={PoDashboardList}
        recordRepresentation="id"
        icon={ShoppingCart}
        options={{ label: "Dashboard OC" }}
      />
      <Resource
        name="po-orders-approval"
        list={PoOrdersApprovalList}
        recordRepresentation="titulo"
        icon={ClipboardCheck}
        options={{ label: "Aprobacion OC" }}
      />
      <Resource
        name="po-orders"
        list={PoOrderList}
        create={PoOrderCreate}
        edit={PoOrderEdit}
        show={PoOrderShow}
        recordRepresentation="titulo"
        icon={ClipboardList}
        options={{ label: "Ordenes" }}
      />
      <Resource
        name="po-invoices"
        list={PoInvoiceList}
        create={PoInvoiceCreate}
        edit={PoInvoiceEdit}
        show={PoInvoiceShow}
        recordRepresentation="numero"
        icon={Receipt}
        options={{ label: "Facturas OC" }}
      />
      <Resource
        name="po-invoices-agenda"
        list={PoInvoiceAgendaList}
        recordRepresentation="numero"
        icon={AgendaPagosIcon}
        options={{ label: "Agenda de pagos" }}
      />
      <Resource
        name="po-setup"
        list={PoSetupPage}
        recordRepresentation="id"
        icon={Settings}
        options={{ label: "Setup" }}
      />
      <Resource
        name="inmobiliaria-setup"
        list={InmobiliariaSetupPage}
        recordRepresentation="id"
        icon={Settings}
        options={{ label: "Setup" }}
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
        name="dashboard-crm"
        list={DashboardCrmList}
        recordRepresentation="id"
        icon={LineChart}
        options={{ label: "CRM Dashboard" }}
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
        options={{ label: "CRM ?? Motivos de Evento" }}
      />
      <Resource
        name="crm/catalogos/respuestas"
        list={CRMCatalogoRespuestaList}
        create={CRMCatalogoRespuestaCreate}
        edit={CRMCatalogoRespuestaEdit}
        show={CRMCatalogoRespuestaShow}
        recordRepresentation="titulo"
        icon={MessageCircle}
        options={{ label: "CRM - Respuestas" }}
      />
      <Resource
        name="monedas"
        list={MonedaList}
        create={MonedaCreate}
        edit={MonedaEdit}
        show={MonedaShow}
        recordRepresentation="nombre"
        icon={Coins}
        options={{ label: "CRM ?? Monedas" }}
      />
      <Resource
        name="crm/contactos"
        list={CRMContactoListAgenda}
        create={CRMContactoCreate}
        edit={CRMContactoEdit}
        show={CRMContactoShow}
        recordRepresentation="nombre_completo"
        icon={UserRound}
        options={{ label: "CRM · Contactos" }}
      />
      <Resource
        name="crm/celulares"
        list={CRMCelularList}
        create={CRMCelularCreate}
        edit={CRMCelularEdit}
        show={CRMCelularShow}
        recordRepresentation="numero_celular"
        icon={Phone}
        options={{ label: "CRM · Celulares" }}
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
        name="crm/crm-eventos"
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
        <Route path="/po/setup/*" element={<PoSetupPage />} />
        <Route path="/crm/setup/*" element={<CRMSetupPage />} />
        <Route path="/crm/admin/*" element={<CRMAdminPage />} />
        <Route path="/crm/panel" element={<CRMOportunidadPanelPage />} />
        <Route path="/crm/oportunidades/:id/accion_cotizar" element={<CRMOportunidadAccionCotizar />} />
        <Route path="/crm/oportunidades/:id/accion_reservar" element={<CRMOportunidadAccionReservar />} />
        <Route path="/crm/oportunidades/:id/accion_agendar" element={<CRMOportunidadAccionAgendar />} />
        <Route path="/crm/oportunidades/:id/accion_cerrar" element={<CRMOportunidadAccionCerrar />} />
        <Route path="/crm/oportunidades/:id/accion_descartar" element={<CRMOportunidadAccionDescartar />} />
        <Route path="/crm/oportunidades/:id/accion_aceptar" element={<CRMOportunidadAccionAceptar />} />
        <Route path="/crm/mensajes/:id/responder" element={<CRMMensajeReply />} />
        <Route path="/calculadora-financiera" element={<CalculadoraFinanciera />} />
      </CustomRoutes>
    </Admin>
  );
};

export default AdminApp;

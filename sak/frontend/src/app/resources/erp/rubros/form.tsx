"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";

import { Confirm } from "@/components/confirm";
import {
  ACTIVO_SELECT_CHOICES,
  ERP_RUBRO_DEFAULTS,
  ERP_RUBRO_VALIDATION,
  erpRubroSchema,
  getErpCuentaDefaults,
  type ErpRubroFormValues,
} from "./model";
import { useAccionesCabeceraRubro } from "./form_hooks";
import { SimpleForm } from "@/components/simple-form";
import {
  DetailFieldCell,
  FormBoolean,
  FormErrorSummary,
  FORM_FIELD_READONLY_CLASS,
  FormNumber,
  FormOrderHeaderMenuActions,
  FormOrderToolbar,
  FormSelect,
  FormText,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
} from "@/components/forms/form_order";
import { cn } from "@/lib/utils";

const RubroDetailEditContext = createContext<{
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
} | null>(null);

const useRubroDetailEdit = () => useContext(RubroDetailEditContext);

export const ErpRubroForm = () => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <RubroDetailEditContext.Provider value={{ isEditing, setIsEditing }}>
      <SimpleForm<ErpRubroFormValues>
        className="w-full max-w-3xl"
        resolver={zodResolver(erpRubroSchema) as any}
        toolbar={<RubroToolbar />}
        defaultValues={ERP_RUBRO_DEFAULTS}
      >
        <FormErrorSummary />
        <CabeceraRubro />
        <DetalleCuentas />
      </SimpleForm>
    </RubroDetailEditContext.Provider>
  );
};

const RubroToolbar = () => {
  const editContext = useRubroDetailEdit();

  return (
    <FormOrderToolbar
      saveProps={{
        variant: "secondary",
        disabled: editContext?.isEditing ?? false,
      }}
    />
  );
};

const CabeceraRubro = () => {
  const {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
  } = useAccionesCabeceraRubro();

  const accionesMenu =
    canPreview || canDelete ? (
      <FormOrderHeaderMenuActions
        canPreview={canPreview}
        canDelete={canDelete}
        onPreview={onPreview}
        onDelete={onRequestDelete}
        previewLabel="Visualizar"
      />
    ) : null;

  return (
    <>
      <SectionBaseTemplate
        title="Rubro"
        main={
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <FormText
                source="nombre"
                label="Rubro"
                validate={required()}
                autoFocus
                widthClass="w-full md:w-[420px]"
                maxLength={ERP_RUBRO_VALIDATION.NOMBRE_MAX_LENGTH}
              />
              <div className="flex h-8 items-center">
                <FormBoolean source="activo" label="Activo" defaultValue />
              </div>
            </div>
            <HiddenInput source="version" />
          </>
        }
        actions={accionesMenu}
      />
      {canDelete ? (
        <Confirm
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Eliminar rubro"
          content="Seguro que deseas eliminar este rubro?"
          confirmColor="warning"
          loading={deleting}
        />
      ) : null}
    </>
  );
};

const DetalleCuentas = () => {
  const editContext = useRubroDetailEdit();
  const handleActiveRowChange = useMemo(
    () => (index: number | null) => {
      editContext?.setIsEditing(index != null);
    },
    [editContext],
  );

  const columns: SectionDetailColumn[] = [
    { label: "Nro.", width: "82px" },
    { label: "Codigo", width: "145px", mobileSpan: "full" },
    { label: "Descripcion", width: "310px", mobileSpan: "full" },
    { label: "Activo", width: "82px" },
    { label: "", width: "minmax(64px,1fr)" },
  ];

  const CuentasCamposPrincipales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <>
        <HiddenInput source="version" />
        <DetailFieldCell label="Nro." data-focus-field="true">
          <FormNumber
            source="nro_cuenta"
            label={false}
            inputMode="numeric"
            min={0}
            step={1}
            validate={required()}
            widthClass="w-full"
            readOnly={!isActive}
            className={cn(
              "gap-0 [&_input]:h-5 [&_input]:px-1 sm:[&_input]:h-6 sm:[&_input]:px-2",
              !isActive ? FORM_FIELD_READONLY_CLASS : undefined,
            )}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Codigo">
          <FormText
            source="cod_cuenta"
            label={false}
            validate={required()}
            widthClass="w-full"
            maxLength={ERP_RUBRO_VALIDATION.COD_CUENTA_MAX_LENGTH}
            readOnly={!isActive}
            className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Descripcion">
          <FormText
            source="descripcion"
            label={false}
            validate={required()}
            widthClass="w-full"
            maxLength={ERP_RUBRO_VALIDATION.DESCRIPCION_MAX_LENGTH}
            readOnly={!isActive}
            className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Activo">
          <FormSelect
            source="activo"
            label={false}
            choices={ACTIVO_SELECT_CHOICES}
            widthClass="w-full"
            disabled={!isActive}
            disableClear
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
          />
        </DetailFieldCell>
      </>
    ),
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Cuentas"
      detailsSource="cuentas"
      mainColumns={columns}
      mainFields={CuentasCamposPrincipales}
      defaults={getErpCuentaDefaults}
      maxHeightClassName="md:max-h-64"
      onActiveRowChange={handleActiveRowChange}
      showInfoAction={false}
      showDeleteWhenInactive
      saveOnlyWhenActive
      showExpandActionOnMobile
      addButtonLabel="Agregar cuenta"
      detailIteratorClassName="[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0"
    />
  );
};


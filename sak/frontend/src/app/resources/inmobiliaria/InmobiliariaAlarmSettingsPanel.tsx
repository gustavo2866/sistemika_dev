"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingRecord = {
  id: number;
  clave: string;
  valor: string;
  descripcion?: string | null;
  updated_at?: string | null;
};

type AlarmSettingDefinition = {
  key: string;
  title: string;
  description: string;
  inputLabel: string;
};

const ALARM_SETTINGS: AlarmSettingDefinition[] = [
  {
    key: "INM_Dias_Vencimiento",
    title: "Contrato vencimiento",
    description: "Cantidad de dias usada para la alarma de contratos proximos a vencer.",
    inputLabel: "Dias para Contrato Venc",
  },
  {
    key: "INM_Dias_Actualizacion",
    title: "Cuota actualizacion",
    description: "Cantidad de dias usada para la alarma de actualizacion de cuota.",
    inputLabel: "Dias para Cuota Actual",
  },
  {
    key: "INM_Dias_Vacancia",
    title: "Vacancia prolongada",
    description: "Cantidad de dias minimos de vacancia para disparar la alarma de vacancia prolongada.",
    inputLabel: "Dias minimos de Vacancia",
  },
];

const DEFAULT_VALUES: Record<string, string> = {
  INM_Dias_Vencimiento: "60",
  INM_Dias_Actualizacion: "60",
  INM_Dias_Vacancia: "90",
};

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  INM_Dias_Vencimiento: "Dias de anticipacion para alarma de vencimiento de contrato en inmobiliaria.",
  INM_Dias_Actualizacion: "Dias de anticipacion para alarma de actualizacion de cuota en inmobiliaria.",
  INM_Dias_Vacancia: "Dias minimos de vacancia para disparar la alarma de vacancia prolongada en inmobiliaria.",
};

const isValidPositiveInteger = (value: string) => /^\d+$/.test(value.trim());

export const InmobiliariaAlarmSettingsPanel = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [settingsByKey, setSettingsByKey] = useState<Record<string, SettingRecord | null>>({});
  const [values, setValues] = useState<Record<string, string>>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedEntries = await Promise.all(
        ALARM_SETTINGS.map(async (settingDef) => {
          const result = await dataProvider.getList<SettingRecord>("settings", {
            pagination: { page: 1, perPage: 1 },
            sort: { field: "id", order: "ASC" },
            filter: { clave: settingDef.key },
          });

          return [settingDef.key, result.data[0] ?? null] as const;
        }),
      );

      const nextSettingsByKey = Object.fromEntries(loadedEntries);
      const nextValues = Object.fromEntries(
        ALARM_SETTINGS.map((settingDef) => [
          settingDef.key,
          nextSettingsByKey[settingDef.key]?.valor ?? DEFAULT_VALUES[settingDef.key],
        ]),
      );

      setSettingsByKey(nextSettingsByKey);
      setValues(nextValues);
    } catch (loadError: any) {
      const message = loadError?.message ?? "No se pudieron cargar las alarmas de inmobiliaria.";
      setError(message);
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [dataProvider, notify]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const invalidKeys = useMemo(
    () =>
      ALARM_SETTINGS.filter((settingDef) => !isValidPositiveInteger(values[settingDef.key] ?? "")).map(
        (settingDef) => settingDef.key,
      ),
    [values],
  );

  const hasChanges = useMemo(
    () =>
      ALARM_SETTINGS.some(
        (settingDef) =>
          (values[settingDef.key] ?? "").trim() !==
          (settingsByKey[settingDef.key]?.valor ?? DEFAULT_VALUES[settingDef.key]),
      ),
    [settingsByKey, values],
  );

  const handleCancel = () => {
    setValues(
      Object.fromEntries(
        ALARM_SETTINGS.map((settingDef) => [
          settingDef.key,
          settingsByKey[settingDef.key]?.valor ?? DEFAULT_VALUES[settingDef.key],
        ]),
      ),
    );
    setError(null);
  };

  const handleValueChange = (key: string, nextValue: string) => {
    setValues((current) => ({ ...current, [key]: nextValue }));
  };

  const handleSave = async () => {
    if (invalidKeys.length > 0) {
      const message = "Todos los parametros deben ser enteros positivos.";
      setError(message);
      notify(message, { type: "warning" });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updatedEntries = await Promise.all(
        ALARM_SETTINGS.map(async (settingDef) => {
          const trimmedValue = (values[settingDef.key] ?? "").trim();
          const currentSetting = settingsByKey[settingDef.key];

          if (currentSetting) {
            const result = await dataProvider.update<SettingRecord>("settings", {
              id: currentSetting.id,
              data: {
                ...currentSetting,
                valor: trimmedValue,
                descripcion: currentSetting.descripcion ?? DEFAULT_DESCRIPTIONS[settingDef.key],
              },
              previousData: currentSetting,
            });
            return [settingDef.key, result.data] as const;
          }

          const result = await dataProvider.create<SettingRecord>("settings", {
            data: {
              clave: settingDef.key,
              valor: trimmedValue,
              descripcion: DEFAULT_DESCRIPTIONS[settingDef.key],
            },
          });
          return [settingDef.key, result.data] as const;
        }),
      );

      const nextSettingsByKey = Object.fromEntries(updatedEntries);
      setSettingsByKey(nextSettingsByKey);
      setValues(
        Object.fromEntries(
          ALARM_SETTINGS.map((settingDef) => [settingDef.key, nextSettingsByKey[settingDef.key]?.valor ?? ""]),
        ),
      );
      notify("Alarmas de inmobiliaria actualizadas.", { type: "success" });
    } catch (saveError: any) {
      const message = saveError?.message ?? "No se pudieron guardar las alarmas de inmobiliaria.";
      setError(message);
      notify(message, { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-4 ${embedded ? "" : "p-4"}`}>
      <Card>
        <CardHeader>
          <CardTitle>Alarmas</CardTitle>
          <CardDescription>
            Edita los parametros que controlan los dias de anticipacion usados por el dashboard de contratos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="multiple" className="space-y-1">
            {ALARM_SETTINGS.map((settingDef) => {
              const record = settingsByKey[settingDef.key];
              const hasValidationError = invalidKeys.includes(settingDef.key);

              return (
                <AccordionItem
                  key={settingDef.key}
                  value={settingDef.key}
                  className="rounded-lg border border-slate-200 bg-white px-4"
                >
                  <AccordionTrigger className="py-3 text-sm font-medium text-slate-900 hover:no-underline">
                    <span className="flex items-center gap-2">
                      {settingDef.title}
                      {hasValidationError ? (
                        <span className="text-xs font-normal text-rose-600">— valor inválido</span>
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">
                          — {values[settingDef.key] ?? DEFAULT_VALUES[settingDef.key]} días
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <p className="mb-3 text-sm text-muted-foreground">{settingDef.description}</p>
                    <p className="mb-3 text-xs text-muted-foreground">Codigo: {settingDef.key}</p>
                    <div className="space-y-2">
                      <Label htmlFor={settingDef.key}>{settingDef.inputLabel}</Label>
                      <Input
                        id={settingDef.key}
                        inputMode="numeric"
                        value={values[settingDef.key] ?? ""}
                        onChange={(event) => handleValueChange(settingDef.key, event.target.value)}
                        disabled={loading || saving}
                        className={hasValidationError ? "border-rose-300 focus-visible:ring-rose-300" : undefined}
                      />
                      {record?.updated_at ? (
                        <p className="text-xs text-muted-foreground">
                          Ultima actualizacion: {new Date(record.updated_at).toLocaleString("es-AR")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Se creara el setting si todavia no existe.</p>
                      )}
                      {hasValidationError ? (
                        <p className="text-xs text-rose-700">Ingresa un numero entero positivo.</p>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading || saving || !hasChanges}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || invalidKeys.length > 0 || !hasChanges}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Grabar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default InmobiliariaAlarmSettingsPanel;
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AgentMode = "manual" | "automatic" | "hybrid";

type AgentModeConfigResponse = {
  agent_mode: AgentMode;
  source: "setting" | "env" | "default";
  allowed_modes: AgentMode[];
  fallback_agent_mode: AgentMode;
  fallback_source: "env" | "default";
  setting?: {
    id: number;
    clave: string;
    valor: string;
    descripcion?: string | null;
    updated_at?: string | null;
  } | null;
};

const AGENT_MODE_OPTIONS: Array<{
  value: AgentMode;
  label: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Manual",
    description: "El webhook registra el mensaje y el agente solo responde desde una accion manual.",
  },
  {
    value: "automatic",
    label: "Automatico",
    description: "El webhook procesa y envia automaticamente la respuesta del agente.",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "El webhook responde automaticamente y la interfaz manual sigue disponible.",
  },
];

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatSourceLabel = (source: AgentModeConfigResponse["source"]) => {
  if (source === "setting") return "setting";
  if (source === "env") return "env";
  return "default";
};

export const CRMChatAgentSettingsPanel = ({
  embedded = false,
}: {
  embedded?: boolean;
}) => {
  const notify = useNotify();
  const [config, setConfig] = useState<AgentModeConfigResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<AgentMode | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = useMemo(
    () => AGENT_MODE_OPTIONS.find((option) => option.value === selectedMode) ?? null,
    [selectedMode],
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/crm/chat-agent/config`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail ?? "No se pudo cargar la configuracion del agente.");
      }
      setConfig(body);
      setSelectedMode(body.agent_mode);
    } catch (loadError: any) {
      const message = loadError?.message ?? "No se pudo cargar la configuracion del agente.";
      setError(message);
      notify(message, { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!selectedMode) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/crm/chat-agent/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          agent_mode: selectedMode,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.detail ?? "No se pudo guardar la configuracion del agente.");
      }
      setConfig(body);
      setSelectedMode(body.agent_mode);
      notify("Modalidad del agente actualizada.", { type: "success" });
    } catch (saveError: any) {
      const message = saveError?.message ?? "No se pudo guardar la configuracion del agente.";
      setError(message);
      notify(message, { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Boolean(config && selectedMode && selectedMode !== config.agent_mode);

  return (
    <div className={`space-y-4 ${embedded ? "" : "p-4"}`}>
      <Card>
        <CardHeader>
          <CardTitle>Modalidad del agente</CardTitle>
          <CardDescription>
            Define como se comporta el agente cuando entra un mensaje por webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              Fuente activa: {config ? formatSourceLabel(config.source) : "cargando"}
            </span>
            {config ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                Fallback: {config.fallback_agent_mode} ({formatSourceLabel(config.fallback_source)})
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Modo operativo</label>
            <Select
              value={selectedMode}
              onValueChange={(value) => setSelectedMode(value as AgentMode)}
              disabled={loading || saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una modalidad" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {selectedOption?.description ??
                "Elige la modalidad global que usara el orquestador del agente."}
            </p>
          </div>

          {config?.setting?.updated_at ? (
            <p className="text-xs text-muted-foreground">
              Ultima actualizacion: {new Date(config.setting.updated_at).toLocaleString("es-AR")}
            </p>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {AGENT_MODE_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={`rounded-lg border p-3 text-sm ${
                  selectedMode === option.value
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="font-medium text-slate-900">{option.label}</div>
                <p className="mt-1 text-muted-foreground">{option.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadConfig()}
            disabled={loading || saving}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refrescar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || !selectedMode || !hasChanges}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar modalidad
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};


export default CRMChatAgentSettingsPanel;

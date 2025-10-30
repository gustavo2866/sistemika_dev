"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDataProvider, useNotify, useRecordContext, useGetIdentity } from "ra-core";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Plus, Save, X, Trash2, Check, ChevronsUpDown } from "lucide-react";

type Articulo = {
  id: number;
  nombre: string;
};

type DetalleItem = {
  id?: number;
  articulo_id: number | null;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
};

type SolicitudData = {
  id?: number;
  tipo: string;
  fecha_necesidad: string;
  solicitante_id: number;
  comentario: string;
  detalles: DetalleItem[];
};

type User = {
  id: number;
  nombre: string;
};

export const SolicitudFormMB = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const record = useRecordContext<SolicitudData>();
  const { data: identity } = useGetIdentity();
  const isEditMode = !!record?.id;

  // Estados del formulario
  const [headerOpen, setHeaderOpen] = useState(!isEditMode); // Expandido en crear, colapsado en editar
  const [formData, setFormData] = useState<SolicitudData>({
    tipo: "normal",
    fecha_necesidad: new Date().toISOString().split("T")[0],
    solicitante_id: 0,
    comentario: "",
    detalles: [],
  });

  // Estados para el diálogo de edición de items
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentItem, setCurrentItem] = useState<DetalleItem>({
    articulo_id: null,
    descripcion: "",
    unidad_medida: "UN",
    cantidad: 1,
  });

  // Catálogos
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [articuloComboboxOpen, setArticuloComboboxOpen] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (record) {
      setFormData({
        id: record.id,
        tipo: record.tipo || "normal",
        fecha_necesidad: record.fecha_necesidad || new Date().toISOString().split("T")[0],
        solicitante_id: record.solicitante_id || 0,
        comentario: record.comentario || "",
        detalles: record.detalles || [],
      });
    }
  }, [record]);

  // Establecer usuario autenticado como solicitante por defecto en modo creación
  useEffect(() => {
    if (!isEditMode && identity?.id && formData.solicitante_id === 0) {
      const userId = typeof identity.id === 'number' ? identity.id : parseInt(identity.id as string);
      if (!isNaN(userId)) {
        setFormData((prev) => ({ ...prev, solicitante_id: userId }));
      }
    }
  }, [identity, isEditMode, formData.solicitante_id]);

  // Cargar catálogos
  useEffect(() => {
    Promise.all([
      dataProvider.getList("articulos", {
        filter: {},
        pagination: { page: 1, perPage: 200 },
        sort: { field: "nombre", order: "ASC" },
      }),
      dataProvider.getList("users", {
        filter: {},
        pagination: { page: 1, perPage: 100 },
        sort: { field: "nombre", order: "ASC" },
      }),
    ])
      .then(([articulosRes, usersRes]) => {
        setArticulos(articulosRes.data as Articulo[]);
        setUsuarios(usersRes.data as User[]);
      })
      .catch((error) => {
        notify("Error cargando catálogos", { type: "error" });
        console.error(error);
      });
  }, [dataProvider, notify]);

  // Helper para manejar Enter en inputs móviles
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements) as HTMLElement[];
        const currentIndex = elements.indexOf(e.currentTarget);
        const nextElement = elements[currentIndex + 1] as HTMLInputElement | HTMLTextAreaElement | null;
        
        if (nextElement && (nextElement.tagName === 'INPUT' || nextElement.tagName === 'TEXTAREA')) {
          nextElement.focus();
        }
      }
    }
  };

  // Handlers del formulario principal
  const handleHeaderChange = (field: keyof SolicitudData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handlers del diálogo de items
  const openCreateDialog = () => {
    setCurrentItem({
      articulo_id: null,
      descripcion: "",
      unidad_medida: "UN",
      cantidad: 1,
    });
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setCurrentItem({ ...formData.detalles[index] });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleItemChange = (field: keyof DetalleItem, value: string | number | null) => {
    setCurrentItem((prev) => ({ ...prev, [field]: value }));
  };

  const saveItem = () => {
    if (!currentItem.descripcion.trim()) {
      notify("La descripción es obligatoria", { type: "warning" });
      return;
    }

    const newDetalles = [...formData.detalles];
    if (editingIndex !== null) {
      newDetalles[editingIndex] = currentItem;
    } else {
      newDetalles.push(currentItem);
    }

    setFormData((prev) => ({ ...prev, detalles: newDetalles }));
    setDialogOpen(false);
  };

  const deleteItemDirectly = (index: number) => {
    const newDetalles = formData.detalles.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, detalles: newDetalles }));
  };

  // Guardar solicitud
  const handleSave = async () => {
    if (!formData.fecha_necesidad || !formData.solicitante_id) {
      notify("Completa los campos obligatorios", { type: "warning" });
      return;
    }

    if (formData.detalles.length === 0) {
      notify("Agrega al menos un artículo", { type: "warning" });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        tipo: formData.tipo,
        fecha_necesidad: formData.fecha_necesidad,
        solicitante_id: formData.solicitante_id,
        comentario: formData.comentario || null,
        detalles: formData.detalles.map((d) => ({
          id: d.id,
          articulo_id: d.articulo_id,
          descripcion: d.descripcion,
          unidad_medida: d.unidad_medida,
          cantidad: d.cantidad,
        })),
      };

      if (isEditMode && formData.id) {
        await dataProvider.update("solicitudes", {
          id: formData.id,
          data: payload,
          previousData: record,
        });
        notify("Solicitud actualizada correctamente", { type: "success" });
      } else {
        await dataProvider.create("solicitudes", { data: payload });
        notify("Solicitud creada correctamente", { type: "success" });
      }

      navigate("/solicitudes");
    } catch (error) {
      notify("Error al guardar la solicitud", { type: "error" });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getArticuloNombre = (id: number | null) => {
    if (!id) return null;
    return articulos.find((a) => a.id === id)?.nombre;
  };

  return (
    <div className="min-h-screen w-full">
      <div className="w-full max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:ml-0 lg:mr-auto">
        {/* Título General */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Solicitudes</h1>
        </div>

        {/* Header Card */}
        <Card>
        <CardHeader className="cursor-pointer" onClick={() => setHeaderOpen(!headerOpen)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Información General
              {isEditMode && <span className="text-muted-foreground">ID: {formData.id}</span>}
            </CardTitle>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${headerOpen ? "" : "-rotate-90"}`}
            />
          </div>
        </CardHeader>

        {headerOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => handleHeaderChange("tipo", value)}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="directa">Compra Directa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_necesidad">Fecha de Necesidad *</Label>
                <Input
                  id="fecha_necesidad"
                  type="date"
                  value={formData.fecha_necesidad}
                  onChange={(e) => handleHeaderChange("fecha_necesidad", e.target.value)}
                  onKeyDown={handleKeyPress}
                  enterKeyHint="next"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="solicitante_id">Solicitante *</Label>
              <Select
                value={formData.solicitante_id.toString()}
                onValueChange={(value) => handleHeaderChange("solicitante_id", parseInt(value))}
              >
                <SelectTrigger id="solicitante_id">
                  <SelectValue placeholder="Selecciona un solicitante" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comentario">Comentario</Label>
              <Textarea
                id="comentario"
                rows={3}
                value={formData.comentario}
                onChange={(e) => handleHeaderChange("comentario", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // En textarea, Shift+Enter permite nueva línea
                  }
                }}
                enterKeyHint="done"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detalles Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Detalle de Artículos</CardTitle>
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {formData.detalles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no se agregaron artículos.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {formData.detalles.map((detalle, index) => {
                const articuloNombre = getArticuloNombre(detalle.articulo_id);
                const displayName = articuloNombre || detalle.descripcion || `Detalle ${index + 1}`;

                return (
                  <Card
                    key={index}
                    className="relative hover:border-primary transition-colors"
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p 
                          className="font-medium text-sm truncate flex-1 cursor-pointer"
                          onClick={() => openEditDialog(index)}
                        >
                          {displayName}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItemDirectly(index);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {articuloNombre && detalle.descripcion && (
                        <p 
                          className="text-xs text-muted-foreground truncate cursor-pointer"
                          onClick={() => openEditDialog(index)}
                        >
                          {detalle.descripcion}
                        </p>
                      )}
                      <div 
                        className="flex items-center gap-1.5 text-xs cursor-pointer"
                        onClick={() => openEditDialog(index)}
                      >
                        <Badge variant="outline" className="text-xs px-1.5 py-0">UM: {detalle.unidad_medida}</Badge>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">Cant: {detalle.cantidad}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border">
        <Button variant="outline" onClick={() => navigate("/solicitudes")} disabled={loading}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      {/* Dialog para editar items */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Editar Artículo" : "Agregar Artículo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="articulo_id">Artículo</Label>
              <Popover open={articuloComboboxOpen} onOpenChange={setArticuloComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={articuloComboboxOpen}
                    className="w-full justify-between"
                  >
                    {currentItem.articulo_id
                      ? articulos.find((art) => art.id === currentItem.articulo_id)?.nombre
                      : "Selecciona un artículo..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar artículo..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron artículos.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="sin-articulo"
                          onSelect={() => {
                            handleItemChange("articulo_id", null);
                            setArticuloComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              currentItem.articulo_id === null ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Sin artículo
                        </CommandItem>
                        {articulos.map((art) => (
                          <CommandItem
                            key={art.id}
                            value={art.nombre}
                            onSelect={() => {
                              handleItemChange("articulo_id", art.id);
                              setArticuloComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentItem.articulo_id === art.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {art.nombre}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                rows={3}
                value={currentItem.descripcion}
                onChange={(e) => handleItemChange("descripcion", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    // En el diálogo, Enter sin Shift avanza al siguiente campo
                    e.preventDefault();
                    const unidadInput = document.getElementById('unidad_medida') as HTMLInputElement;
                    if (unidadInput) unidadInput.focus();
                  }
                }}
                enterKeyHint="next"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unidad_medida">Unidad de Medida</Label>
                <Input
                  id="unidad_medida"
                  value={currentItem.unidad_medida}
                  onChange={(e) => handleItemChange("unidad_medida", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const cantidadInput = document.getElementById('cantidad') as HTMLInputElement;
                      if (cantidadInput) cantidadInput.focus();
                    }
                  }}
                  maxLength={4}
                  enterKeyHint="next"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.cantidad}
                  onChange={(e) => handleItemChange("cantidad", parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveItem();
                    }
                  }}
                  enterKeyHint="done"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveItem}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

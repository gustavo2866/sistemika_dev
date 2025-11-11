export enum TipoArticulo {
  Material = "Material",
  Ferreteria = "Ferreteria",
  Herramienta = "Herramienta",
  Sanitario = "Sanitario",
  Griferia = "Griferia",
  Perfileria = "Perfileria",
  Pintura = "Pintura",
  Sellador = "Sellador",
  Impermeabilizante = "Impermeabilizante",
}

export const TIPO_ARTICULO_CHOICES = Object.values(TipoArticulo).map((value) => ({
  id: value,
  name: value,
}));

export type TipoArticuloValue = `${TipoArticulo}`;

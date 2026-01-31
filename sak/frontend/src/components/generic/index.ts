/**
 * Generic Components - Componentes genéricos reutilizables
 * 
 * Exports para facilitar la importación de todos los componentes genéricos
 */

export { HeaderSummaryDisplay } from "./HeaderSummaryDisplay";
export { 
  useReferenceFieldWatcher,
  useArticuloWatcher,
  useProveedorWatcher,
  useCentroCostoWatcher,
} from "./ReferenceFieldWatcher";
export { 
  ConditionalFieldLock,
  useFieldLockByState,
  useDetailFieldLock,
} from "./ConditionalFieldLock";
export { 
  StandardFormGrid,
  createTwoColumnSection,
  createThreeColumnSection,
  createFullSpanSection,
} from "./StandardFormGrid";
import { toast } from "sonner";

export const confirmItems = async (itemIds: number[]) => {
  // Mock function para confirmar items
  try {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(`${itemIds.length} item(s) confirmado(s) exitosamente`);
    return { success: true, confirmedIds: itemIds };
  } catch (error) {
    toast.error("Error al confirmar items");
    throw error;
  }
};

export const processItems = async (itemIds: number[]) => {
  // Mock function para procesar items
  try {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success(`${itemIds.length} item(s) procesado(s) exitosamente`);
    return { success: true, processedIds: itemIds };
  } catch (error) {
    toast.error("Error al procesar items");
    throw error;
  }
};

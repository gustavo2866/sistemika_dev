/**
 * Action Executor
 * 
 * Executes actions with proper error handling, confirmation, and notifications
 */

import { Identifier } from "ra-core";
import { ActionConfig, ActionHelpers } from "../types";

export async function executeAction(
  action: ActionConfig,
  ids: Identifier[],
  record: any | null,
  helpers: ActionHelpers,
): Promise<void> {
  const { notify, refresh, dataProvider } = helpers;
  
  // Check if enabled for individual actions
  if (record && action.isEnabled && !action.isEnabled(record)) {
    notify("Acción no disponible", { type: "info" });
    return;
  }
  
  // Confirmation
  if (action.confirm) {
    const content = typeof action.confirm.content === "function"
      ? action.confirm.content(ids.length, record ? [record] : undefined)
      : action.confirm.content;
      
    if (!window.confirm(`${action.confirm.title}\n\n${content}`)) {
      return;
    }
  }
  
  try {
    // Execute based on type
    if (action.action) {
      // Custom action function
      await action.action(ids, helpers);
      
    } else if (action.mutation) {
      // Declarative mutation
      const data = typeof action.mutation.data === "function"
        ? action.mutation.data(record)
        : action.mutation.data || {};
        
      const resource = action.name.includes("_") 
        ? action.name.split("_")[0] 
        : helpers.dataProvider.getResourceName?.() || "unknown";
        
      if (action.mutation.type === "updateMany") {
        if (ids.length === 1 && record) {
          await dataProvider.update(resource, {
            id: ids[0],
            data,
            previousData: record,
          });
        } else {
          await dataProvider.updateMany(resource, {
            ids,
            data,
          });
        }
      } else if (action.mutation.type === "deleteMany") {
        if (ids.length === 1 && record) {
          await dataProvider.delete(resource, {
            id: ids[0],
            previousData: record,
          });
        } else {
          await dataProvider.deleteMany(resource, { ids });
        }
      } else if (action.mutation.type === "create") {
        await dataProvider.create(resource, { data });
      }
    }
    
    // Success message
    const successMsg = typeof action.successMessage === "function"
      ? action.successMessage(ids.length, record ? [record] : undefined)
      : action.successMessage || "Acción completada";
      
    notify(successMsg, { type: "success" });
    
    // Unselect if bulk action
    if (helpers.unselectAll) {
      helpers.unselectAll();
    }
    
    refresh();
    
  } catch (error: any) {
    const errorMsg = typeof action.errorMessage === "function"
      ? action.errorMessage(error)
      : action.errorMessage || error?.message || "Error al ejecutar la acción";
      
    notify(errorMsg, { type: "error" });
    throw error;
  }
}

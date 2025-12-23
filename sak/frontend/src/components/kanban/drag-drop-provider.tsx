"use client";

import * as React from "react";
import { useKanbanDragDrop } from "./use-kanban-drag-drop";
import type {
  UseKanbanDragDropOptions,
  UseKanbanDragDropResult,
} from "./use-kanban-drag-drop";

type KanbanDragDropContextValue = UseKanbanDragDropResult<any, any>;

const KanbanDragDropContext = React.createContext<KanbanDragDropContextValue | null>(null);

export const KanbanDragDropProvider = <TItem, K extends string>({
  children,
  ...options
}: UseKanbanDragDropOptions<TItem, K> & { children: React.ReactNode }) => {
  const value = useKanbanDragDrop<TItem, K>(options);

  return (
    <KanbanDragDropContext.Provider value={value}>
      {children}
    </KanbanDragDropContext.Provider>
  );
};

export const useKanbanDragDropContext = <TItem, K extends string>() => {
  const context = React.useContext(KanbanDragDropContext);

  if (!context) {
    throw new Error("useKanbanDragDropContext must be used within KanbanDragDropProvider");
  }

  return context as UseKanbanDragDropResult<TItem, K>;
};

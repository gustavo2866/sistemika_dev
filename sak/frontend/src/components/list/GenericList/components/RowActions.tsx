/**
 * RowActions - Renders action buttons for a row
 * 
 * Supports both inline buttons and dropdown menu
 */

import { useState } from "react";
import { useRecordContext, useNotify, useRefresh, useDataProvider } from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as Icons from "lucide-react";
import { ActionConfig } from "../types";
import { executeAction } from "../utils/action-executor";

interface RowActionsProps {
  actions: ActionConfig[];
  mode?: "inline" | "menu" | "mixed";
  maxInline?: number;
}

export const RowActions = ({ 
  actions, 
  mode = "mixed",
  maxInline = 2 
}: RowActionsProps) => {
  const record = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const navigate = useNavigate();
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  if (!record) return null;

  // Filter actions that are visible and have individual scope
  const visibleActions = actions.filter((action) => {
    if (action.individual === "none") return false;
    if (action.isVisible && !action.isVisible(record)) return false;
    return true;
  });

  if (visibleActions.length === 0) return null;

  const handleAction = async (action: ActionConfig) => {
    if (action.isEnabled && !action.isEnabled(record)) return;

    setIsExecuting(action.name);
    try {
      await executeAction(
        action,
        [record.id],
        record,
        { notify, refresh, dataProvider, navigate }
      );
    } catch (error) {
      console.error(`Error executing action ${action.name}:`, error);
      notify(`Error al ejecutar la acción`, { type: "error" });
    } finally {
      setIsExecuting(null);
    }
  };

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  // All inline mode
  if (mode === "inline") {
    return (
      <div className="flex items-center gap-2">
        {visibleActions.map((action) => (
          <Button
            key={action.name}
            variant={action.variant || "outline"}
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAction(action);
            }}
            disabled={
              isExecuting === action.name ||
              (action.isEnabled && !action.isEnabled(record))
            }
          >
            {getIcon(action.icon)}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    );
  }

  // All menu mode
  if (mode === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Icons.MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visibleActions.map((action) => (
            <DropdownMenuItem
              key={action.name}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAction(action);
              }}
              disabled={
                isExecuting === action.name ||
                (action.isEnabled && !action.isEnabled(record))
              }
              className={
                action.variant === "destructive" 
                  ? "text-destructive focus:text-destructive" 
                  : ""
              }
            >
              {getIcon(action.icon)}
              <span className="ml-2">{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Mixed mode: some inline, rest in menu
  const inlineActions = visibleActions
    .filter(a => a.individual === "inline")
    .slice(0, maxInline);
  const menuActions = visibleActions.filter(
    a => a.individual === "menu" || 
         !inlineActions.includes(a)
  );

  return (
    <div className="flex items-center gap-2">
      {inlineActions.map((action) => (
        <Button
          key={action.name}
          variant={action.variant || "outline"}
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAction(action);
          }}
          disabled={
            isExecuting === action.name ||
            (action.isEnabled && !action.isEnabled(record))
          }
        >
          {getIcon(action.icon)}
        </Button>
      ))}
      
      {menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Icons.MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuActions.map((action) => (
              <DropdownMenuItem
                key={action.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction(action);
                }}
                disabled={
                  isExecuting === action.name ||
                  (action.isEnabled && !action.isEnabled(record))
                }
                className={
                  action.variant === "destructive" 
                    ? "text-destructive focus:text-destructive" 
                    : ""
                }
              >
                {getIcon(action.icon)}
                <span className="ml-2">{action.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

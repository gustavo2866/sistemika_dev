"use client";

import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const buildCreatePathWithTipoCompra = (
  basePath: string | undefined,
  tipoCompra: "normal" | "directa",
) => {
  const target = basePath && basePath.trim() !== "" ? basePath : "/po-orders/create";
  const [pathname, queryString = ""] = target.split("?");
  const params = new URLSearchParams(queryString);
  params.set("tipo_compra", tipoCompra);
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
};

type PoOrderCreateMenuButtonProps = {
  createTo?: string;
  className?: string;
  label?: string;
  align?: "start" | "center" | "end";
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  icon?: LucideIcon;
  onNavigate?: (path: string) => void;
};

export const PoOrderCreateMenuButton = ({
  createTo,
  className,
  label = "Crear",
  align = "start",
  variant = "outline",
  size = "sm",
  icon: Icon = Plus,
  onNavigate,
}: PoOrderCreateMenuButtonProps) => {
  const navigate = useNavigate();
  const handleNavigate = onNavigate ?? navigate;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        <DropdownMenuItem
          onClick={() => handleNavigate(buildCreatePathWithTipoCompra(createTo, "normal"))}
        >
          Crear Normal
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleNavigate(buildCreatePathWithTipoCompra(createTo, "directa"))}
        >
          Crear Directa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import { ResourceBackButton } from "@/components/resource-back-button";

type PedidoBackButtonProps = {
  returnTo?: string;
};

export const PedidoBackButton = ({ returnTo }: PedidoBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/constructora/pedidos" />
);

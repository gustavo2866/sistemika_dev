import { ResourceBackButton } from "@/components/resource-back-button";

type ContratoBackButtonProps = {
  returnTo?: string;
};

export const ContratoBackButton = ({ returnTo }: ContratoBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/contratos" />
);

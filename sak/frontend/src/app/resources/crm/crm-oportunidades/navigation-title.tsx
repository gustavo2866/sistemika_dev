import { ResourceBackButton } from "@/components/resource-back-button";

type CRMOportunidadBackButtonProps = {
  returnTo?: string;
};

export const CRMOportunidadBackButton = ({ returnTo }: CRMOportunidadBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/crm/oportunidades" />
);

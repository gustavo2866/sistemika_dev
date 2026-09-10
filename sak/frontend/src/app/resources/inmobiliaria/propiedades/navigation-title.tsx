import { ResourceBackButton } from "@/components/resource-back-button";

type PropiedadBackButtonProps = {
  returnTo?: string;
};

export const PropiedadBackButton = ({ returnTo }: PropiedadBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/propiedades" />
);

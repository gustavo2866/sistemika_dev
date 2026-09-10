import { ResourceBackButton } from "@/components/resource-back-button";

type ProyectoBackButtonProps = {
  returnTo?: string;
};

export const ProyectoBackButton = ({ returnTo }: ProyectoBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/proyectos" />
);

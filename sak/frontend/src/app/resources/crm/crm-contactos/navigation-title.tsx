import { ResourceBackButton } from "@/components/resource-back-button";

type CRMContactoBackButtonProps = {
  fallbackTo?: string;
  returnTo?: string;
};

export const CRMContactoBackButton = ({
  fallbackTo = "/crm/contactos",
  returnTo,
}: CRMContactoBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo={fallbackTo} />
);

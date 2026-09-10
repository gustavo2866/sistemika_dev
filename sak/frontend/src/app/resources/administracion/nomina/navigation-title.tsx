import { ResourceBackButton } from "@/components/resource-back-button";

type NominaBackButtonProps = {
  returnTo?: string;
};

export const NominaBackButton = ({ returnTo }: NominaBackButtonProps) => (
  <ResourceBackButton
    returnTo={returnTo}
    fallbackTo="/constructora-admin"
    historyFallback={false}
  />
);

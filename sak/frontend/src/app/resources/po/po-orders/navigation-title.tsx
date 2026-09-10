import { ResourceBackButton } from "@/components/resource-back-button";

type PoOrderBackButtonProps = {
  returnTo?: string;
};

export const PoOrderBackButton = ({ returnTo }: PoOrderBackButtonProps) => (
  <ResourceBackButton returnTo={returnTo} fallbackTo="/po-orders" />
);

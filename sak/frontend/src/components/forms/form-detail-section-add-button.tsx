import { AddItemButton } from "./add-item-button";
import { useFormDetailSectionContext } from "./form-detail-section-context";

interface FormDetailSectionAddButtonProps {
  label?: string;
}

export const FormDetailSectionAddButton = ({ label }: FormDetailSectionAddButtonProps) => {
  const { handleStartCreate } = useFormDetailSectionContext();

  return (
    <AddItemButton
      label={label ?? "Agregar item"}
      onClick={handleStartCreate}
    />
  );
};

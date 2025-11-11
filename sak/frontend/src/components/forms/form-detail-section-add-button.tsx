import { AddItemButton } from "./add-item-button";
import { useFormDetailSectionContext } from "./form-detail-section-context";

interface FormDetailSectionAddButtonProps {
  label?: string;
}

export const FormDetailSectionAddButton = ({
  label,
}: FormDetailSectionAddButtonProps) => {
  const { handleStartCreate } = useFormDetailSectionContext();

  return (
    <div className="-mt-5 mb-2 border-b border-border/60 pt-0.5 pb-1.5">
      <AddItemButton
        label={label ?? "Agregar item"}
        onClick={handleStartCreate}
        className="w-full"
      />
    </div>
  );
};

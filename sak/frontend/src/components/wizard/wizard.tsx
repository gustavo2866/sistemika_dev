import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";

export const WizardSectionHeader = ({ title }: { title: string }) => (
  <div className="space-y-2">
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </div>
    <div className="h-px w-full bg-muted/70" />
  </div>
);

export const WizardNavigation = ({
  step,
  totalSteps,
  onBack,
  onNext,
  disableBack,
  disableNext,
  backLabel = "Anterior",
  nextLabel = "Siguiente",
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  disableBack?: boolean;
  disableNext?: boolean;
  backLabel?: string;
  nextLabel?: string;
}) => (
  <div className="flex items-center justify-between border-t bg-muted/30 -mx-6 px-6 py-0 min-h-8">
    <Button
      type="button"
      variant="outline"
      onClick={onBack}
      disabled={disableBack}
      className="flex items-center gap-1 h-6 px-2 text-xs leading-none"
    >
      {"<-"} {backLabel}
    </Button>

    <div className="text-xs text-muted-foreground leading-none">
      Paso {step} de {totalSteps}
    </div>

    <Button
      type="button"
      variant="outline"
      onClick={onNext}
      disabled={disableNext}
      className="flex items-center gap-1 h-6 px-2 text-xs leading-none"
    >
      {nextLabel} {"->"}
    </Button>
  </div>
);

export const WizardConfirmCancel = ({
  open,
  onClose,
  onConfirm,
  title = "Salir del asistente",
  content = "Hay cambios sin guardar. Deseas salir?",
  confirmLabel = "Salir",
  cancelLabel = "Volver",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  content?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => (
  <Confirm
    isOpen={open}
    onClose={onClose}
    onConfirm={onConfirm}
    title={title}
    content={content}
    confirm={confirmLabel}
    cancel={cancelLabel}
  />
);

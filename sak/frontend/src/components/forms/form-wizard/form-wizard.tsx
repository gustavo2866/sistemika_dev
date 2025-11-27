import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormWizardStep = {
  title: string;
  description?: string;
  content: ReactNode;
};

export interface FormWizardProps {
  steps: FormWizardStep[];
  initialStep?: number;
  onStepChange?: (index: number) => void;
  onStepValidate?: (index: number) => boolean | Promise<boolean>;
  onFinish?: () => void | Promise<void>;
  isSubmitting?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  finishLabel?: string;
  className?: string;
}

export const FormWizard = ({
  steps,
  initialStep = 0,
  onStepChange,
  onStepValidate,
  onFinish,
  isSubmitting,
  nextLabel = "Siguiente",
  prevLabel = "Anterior",
  finishLabel = "Confirmar",
  className,
}: FormWizardProps) => {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const goToStep = (index: number) => {
    setCurrentStep(index);
    onStepChange?.(index);
  };

  const handleNext = async () => {
    if (onStepValidate) {
      const valid = await onStepValidate(currentStep);
      if (!valid) {
        return;
      }
    }
    const lastStep = currentStep === steps.length - 1;
    if (lastStep) {
      onFinish?.();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  if (!steps || steps.length === 0) {
    return null;
  }

  const activeStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Paso {currentStep + 1} de {steps.length}
          </p>
          <h4 className="text-base font-semibold">{activeStep.title}</h4>
          {activeStep.description ? (
            <p className="text-sm text-muted-foreground">{activeStep.description}</p>
          ) : null}
        </div>
        <div className="flex gap-1">
          {steps.map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 w-2 rounded-full",
                index === currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <div>
        {steps.map((step, index) => (
          <div
            key={`${step.title}-${index}`}
            role="tabpanel"
            aria-hidden={index !== currentStep}
            className={cn(index === currentStep ? "block" : "hidden")}
          >
            {step.content}
          </div>
        ))}
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={currentStep === 0 || isSubmitting} onClick={handlePrev}>
          {prevLabel}
        </Button>
        <Button onClick={handleNext} disabled={isSubmitting}>
          {isLastStep ? finishLabel : nextLabel}
        </Button>
      </div>
    </div>
  );
};

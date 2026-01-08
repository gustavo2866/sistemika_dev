import { type ReactNode } from "react";
import { CollapsibleSection } from "./collapsible-section";

export interface FormSection {
  id: string;
  title: string;
  subtitle?: string | (() => string);
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  headerContent?: ReactNode;
  headerContentPosition?: "inline" | "below";
  variant?: "default" | "outlined" | "ghost";
  contentPadding?: "none" | "sm" | "md" | "lg";
  className?: string;
  contentClassName?: string;
  onToggle?: (isOpen: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface FormLayoutProps {
  sections: FormSection[];
  spacing?: "none" | "sm" | "md" | "lg";
  className?: string;
}

export const FormLayout = ({ sections, spacing = "md", className }: FormLayoutProps) => {
  const spacingClasses = {
    none: "space-y-0",
    sm: "space-y-2",
    md: "space-y-4",
    lg: "space-y-6",
  };

  return (
    <div className={`${spacingClasses[spacing]} ${className || ""}`}>
      {sections.map((section) => {
        const { id, ...sectionProps } = section;
        
        return (
          <CollapsibleSection
            key={id}
            {...sectionProps}
          />
        );
      })}
    </div>
  );
};

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface FormSection {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  headerContent?: ReactNode;
}

interface FormLayoutProps {
  sections: FormSection[];
}

export const FormLayout = ({ sections }: FormLayoutProps) => {
  // Initialize state for each section
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((section) => {
      initial[section.id] = section.defaultOpen ?? true;
    });
    return initial;
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const isOpen = openSections[section.id] ?? true;

        return (
          <Card key={section.id}>
            <div className="border-b px-4 py-3">
              <div className="flex items-start gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-1 h-8 w-8"
                  onClick={() => toggleSection(section.id)}
                  aria-label={isOpen ? `Colapsar ${section.title}` : `Expandir ${section.title}`}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                </Button>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  {section.subtitle && (
                    <p className="text-sm text-muted-foreground">{section.subtitle}</p>
                  )}
                </div>
              </div>
              {section.headerContent && <div className="mt-3">{section.headerContent}</div>}
            </div>
            <CardContent className={`space-y-4 ${isOpen ? "block" : "hidden"} p-4`}>
              {section.children}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

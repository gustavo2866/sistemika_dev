import { KeyboardEvent } from "react";

/**
 * Hook para manejar la navegación con tecla Enter en formularios móviles
 * 
 * @returns handleKeyPress - Handler para eventos onKeyDown de inputs/textareas
 * 
 * @example
 * ```tsx
 * const { handleKeyPress } = useEnterKeyNavigation();
 * 
 * <Input
 *   onKeyDown={handleKeyPress}
 *   enterKeyHint="next"
 * />
 * ```
 */
export const useEnterKeyNavigation = () => {
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements) as HTMLElement[];
        const currentIndex = elements.indexOf(e.currentTarget);
        const nextElement = elements[currentIndex + 1] as HTMLInputElement | HTMLTextAreaElement | null;
        
        if (nextElement && (nextElement.tagName === 'INPUT' || nextElement.tagName === 'TEXTAREA')) {
          nextElement.focus();
        }
      }
    }
  };

  return { handleKeyPress };
};

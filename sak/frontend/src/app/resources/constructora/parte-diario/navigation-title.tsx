import { ResourceBackButton } from "@/components/resource-back-button";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

type ParteDiarioBackButtonProps = {
  fallbackPath?: string;
  returnTo?: string | null;
};

export const ParteDiarioBackButton = ({
  fallbackPath = "/parte-diario",
  returnTo,
}: ParteDiarioBackButtonProps) => (
  <ResourceBackButton
    returnTo={returnTo}
    fallbackTo={fallbackPath}
    resolveLocationReturnTo={false}
    stopPropagation
    className="h-8 px-2 text-sm"
    iconClassName="h-3.5 w-3.5"
  />
);

type ParteDiarioAgentChatButtonProps = {
  disabled?: boolean;
  disabledReason?: string;
  initialMessage?: string;
  loading?: boolean;
  fromName?: string;
  fromPhone?: string;
  returnTo?: string | null;
};

export const ParteDiarioAgentChatButton = ({
  disabled = false,
  disabledReason,
  initialMessage,
  loading = false,
  fromName,
  fromPhone,
  returnTo,
}: ParteDiarioAgentChatButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    const params = new URLSearchParams();
    params.set("source", "parte-diario");
    if (initialMessage?.trim()) params.set("message", initialMessage.trim());
    if (fromPhone?.trim()) params.set("from_phone", fromPhone.trim());
    if (fromName?.trim()) params.set("from_name", fromName.trim());
    if (returnTo?.trim()) params.set("returnTo", returnTo.trim());
    const query = params.toString();
    navigate(`/agente-chat${query ? `?${query}` : ""}`);
  };

  const title = loading ? "Leyendo telefono del contacto." : disabled ? disabledReason : undefined;

  return (
    <span title={title}>
    <Button
      type="button"
      variant="outline"
      className="h-7 gap-1 px-2 text-xs"
      disabled={disabled}
      onClick={handleClick}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? "Leyendo" : "IA"}
    </Button>
    </span>
  );
};

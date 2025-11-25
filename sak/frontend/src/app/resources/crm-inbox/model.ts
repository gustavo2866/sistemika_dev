export type CRMMensaje = {
  id: number;
  tipo: string;
  canal: string;
  estado: string;
  created_at?: string;
  fecha_mensaje?: string;
  contacto_referencia?: string | null;
  asunto?: string | null;
  contenido?: string | null;
  metadata?: Record<string, any>;
};

export const CRM_INBOX_FILTER = { tipo: "entrada" };

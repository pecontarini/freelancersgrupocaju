/**
 * Link individual de confirmação D-1 (página pública /confirm-shift/:id).
 * Usado tanto na Gestão D-1 quanto no cadastro prévio de freelancer no editor de escalas.
 */

export function buildConfirmUrl(scheduleId: string): string {
  return `${window.location.origin}/confirm-shift/${scheduleId}`;
}

function formatDateLabelPtBr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const dayMonth = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  return `${weekday}, ${dayMonth}`;
}

export function buildConfirmMessage(params: {
  nome: string;
  data: string; // YYYY-MM-DD
  inicio?: string | null;
  fim?: string | null;
  scheduleId: string;
}): string {
  const startStr = params.inicio?.slice(0, 5) || "—";
  const endStr = params.fim?.slice(0, 5) || "—";
  const dateLabel = formatDateLabelPtBr(params.data);

  return (
    `Olá ${params.nome}! Você tem turno ${dateLabel} (${startStr} às ${endStr}). ` +
    `Por favor, confirme sua presença neste link rápido:\n${buildConfirmUrl(params.scheduleId)}`
  );
}

export function buildConfirmWhatsAppLink(params: {
  nome: string;
  telefone?: string | null;
  data: string;
  inicio?: string | null;
  fim?: string | null;
  scheduleId: string;
}): string {
  const phone = (params.telefone || "").replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildConfirmMessage(params))}`;
}

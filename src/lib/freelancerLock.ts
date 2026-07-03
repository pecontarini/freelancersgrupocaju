// Trava global de UI para lançamentos de freelancer.
// Enquanto FREELANCER_LAUNCH_LOCKED = true, todos os pontos visíveis do app
// (formulário manual, importação de planilha, check-in via QR) ficam
// bloqueados. NÃO altera policies/RLS — bloqueio apenas na interface.
export const FREELANCER_LAUNCH_LOCKED = true;

export const FREELANCER_LOCK_MESSAGE =
  "Lançamentos de freelancer estão temporariamente bloqueados. Procure a liderança para mais informações.";

export const FREELANCER_LOCK_SHORT = "Lançamentos bloqueados";

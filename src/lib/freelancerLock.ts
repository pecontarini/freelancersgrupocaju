// Trava global de UI para lançamentos de freelancer.
// Bloqueio apenas na interface (não altera RLS/policies).
//
// Enquanto FREELANCER_LAUNCH_LOCKED = true, todos os pontos visíveis do app
// (formulário manual, importação de planilha, check-in via QR) ficam
// bloqueados — EXCETO para as lojas listadas em
// FREELANCER_LAUNCH_ALLOWED_LOJA_IDS, que continuam liberadas.
export const FREELANCER_LAUNCH_LOCKED = true;

// Lojas liberadas mesmo com a trava global ativa (loja_id de config_lojas).
// Adicione/remova UUIDs aqui para liberar novas unidades pontualmente.
export const FREELANCER_LAUNCH_ALLOWED_LOJA_IDS: ReadonlySet<string> = new Set<string>([
  // CAJU - ITAIM
  "87228077-03ab-445b-a409-237972ee6719",
]);

export const FREELANCER_LOCK_MESSAGE =
  "Lançamentos de freelancer estão temporariamente bloqueados para esta loja. Procure a liderança para mais informações.";

export const FREELANCER_LOCK_SHORT = "Lançamentos bloqueados";

/**
 * Retorna `true` quando a loja informada está bloqueada para lançamentos.
 * Se `lojaId` for indefinido, respeita apenas a trava global.
 */
export function isFreelancerLaunchLocked(lojaId?: string | null): boolean {
  if (!FREELANCER_LAUNCH_LOCKED) return false;
  if (!lojaId) return true;
  return !FREELANCER_LAUNCH_ALLOWED_LOJA_IDS.has(lojaId);
}

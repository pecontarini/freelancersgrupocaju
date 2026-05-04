/**
 * Mapeamento centralizado de nomes de exibição e cores de marca por loja_codigo.
 * Usado em /painel/metas para padronizar a apresentação das lojas.
 */

export interface LojaDisplay {
  nome: string;
  marca: string;
  sigla: string;
  cor: string;
}

export const LOJA_DISPLAY: Record<string, LojaDisplay> = {
  CJ_AN: { nome: "Caju Limão · Asa Norte", marca: "Caju Limão", sigla: "CJ", cor: "#F59E0B" },
  CJ_SG: { nome: "Caju Limão · SIG", marca: "Caju Limão", sigla: "CJ", cor: "#F59E0B" },
  CP_AC: { nome: "Caminito · Águas Claras", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_AN: { nome: "Caminito · Asa Norte", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_AS: { nome: "Caminito · Asa Sul", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  CP_SG: { nome: "Caminito · SIG", marca: "Caminito Parrilla", sigla: "CP", cor: "#EF4444" },
  NZ_AC: { nome: "Nazo · Águas Claras", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_AS: { nome: "Nazo · Asa Sul", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_GO: { nome: "Nazo · Goiânia", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
  NZ_SG: { nome: "Nazo · SIG", marca: "Nazo Japanese", sigla: "NZ", cor: "#6366F1" },
};

export function getLojaDisplay(codigo: string): LojaDisplay {
  return (
    LOJA_DISPLAY[codigo] ?? {
      nome: codigo,
      marca: "",
      sigla: (codigo ?? "").slice(0, 2),
      cor: "#6B7280",
    }
  );
}

export function getLojaBadge(codigo: string) {
  const l = getLojaDisplay(codigo);
  return { sigla: l.sigla, cor: l.cor, nomeCompleto: l.nome, marca: l.marca };
}

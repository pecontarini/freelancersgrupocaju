export interface MaintenanceEntry {
  id: string;
  created_at: string;
  loja_id: string | null;
  loja: string;
  fornecedor: string;
  data_servico: string;
  numero_nf: string;
  valor: number;
  descricao: string | null;
  anexo_url: string | null;
  boleto_url: string | null;
  created_by: string | null;
  cpf_cnpj: string | null;
  chave_pix: string | null;
}

export interface MaintenanceBudget {
  id: string;
  created_at: string;
  updated_at: string;
  loja_id: string | null;
  budget_mensal: number;
}

export interface MaintenanceFormData {
  loja: string;
  loja_id: string;
  cpf_cnpj: string | null;
  fornecedor: string;
  chave_pix: string | null;
  data_servico: string;
  numero_nf: string;
  valor: number;
  descricao: string;
  anexo_url: string | null;
  boleto_url: string | null;
}

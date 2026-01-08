export interface FreelancerEntry {
  id: string;
  loja: string;
  nome_completo: string;
  setor: string;
  gerencia: string;
  data_pop: string;
  valor: number;
  cpf: string;
  chave_pix: string;
  created_at: string;
}

export interface FreelancerFormData {
  loja: string;
  nome_completo: string;
  setor: string;
  gerencia: string;
  data_pop: Date;
  valor: number;
  cpf: string;
  chave_pix: string;
}

export interface FilterState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  setor: string;
  gerencia: string;
  nome: string;
  loja: string;
}

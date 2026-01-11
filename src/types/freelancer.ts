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
  created_by: string | null;
  loja_id: string | null;
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
  loja_id: string;
}

export interface FilterState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  setor: string;
  gerencia: string;
  nome: string;
  loja: string;
}

export type AppRole = 'admin' | 'gerente_unidade';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  unidade_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface ConfigOption {
  id: string;
  nome: string;
  created_at: string;
}

export interface FreelancerEntry {
  id: string;
  loja: string;
  nome_completo: string | null;
  funcao: string | null;
  setor: string | null;
  gerencia: string | null;
  data_pop: string;
  valor: number | null;
  cpf: string | null;
  chave_pix: string | null;
  substitui: string | null;
  motivo: string | null;
  created_at: string;
  created_by: string | null;
  loja_id: string | null;
  schedule_id?: string | null;
  origem?: 'manual' | 'escala' | 'checkin' | 'publico';
  status?: 'pendente' | 'confirmado' | null;
  solicitante_nome?: string | null;
  solicitante_telefone?: string | null;
}

export interface FreelancerFormData {
  loja: string;
  nome_completo: string;
  funcao?: string;
  setor?: string;
  gerencia?: string | null;
  data_pop: string; // String no formato YYYY-MM-DD
  valor: number;
  cpf: string;
  chave_pix: string;
  loja_id: string;
  substitui: string;
  motivo: string;
}

export interface FilterState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  funcao: string;
  gerencia: string;
  nome: string;
  loja: string;
}

export type AppRole = 'admin' | 'super_admin' | 'operator' | 'gerente_unidade' | 'chefe_setor' | 'employee';

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

export interface UserStore {
  id: string;
  user_id: string;
  loja_id: string;
  created_at: string;
}

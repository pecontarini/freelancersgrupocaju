export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      avaliacoes: {
        Row: {
          cargo_id: string
          codigo_meta: Database["public"]["Enums"]["codigo_meta"]
          created_at: string
          fonte: Database["public"]["Enums"]["origem_dado"]
          id: string
          loja_id: string
          metadata: Json | null
          referencia_mes: string
          score_percentual: number
          updated_at: string
        }
        Insert: {
          cargo_id: string
          codigo_meta: Database["public"]["Enums"]["codigo_meta"]
          created_at?: string
          fonte?: Database["public"]["Enums"]["origem_dado"]
          id?: string
          loja_id: string
          metadata?: Json | null
          referencia_mes: string
          score_percentual?: number
          updated_at?: string
        }
        Update: {
          cargo_id?: string
          codigo_meta?: Database["public"]["Enums"]["codigo_meta"]
          created_at?: string
          fonte?: Database["public"]["Enums"]["origem_dado"]
          id?: string
          loja_id?: string
          metadata?: Json | null
          referencia_mes?: string
          score_percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_config: {
        Row: {
          base_bonus_value: number
          created_at: string
          id: string
          loja_id: string | null
          month_year: string
          position_type: Database["public"]["Enums"]["position_type"]
          updated_at: string
        }
        Insert: {
          base_bonus_value?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          month_year: string
          position_type: Database["public"]["Enums"]["position_type"]
          updated_at?: string
        }
        Update: {
          base_bonus_value?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          month_year?: string
          position_type?: Database["public"]["Enums"]["position_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_rules: {
        Row: {
          created_at: string
          id: string
          percentage: number
          position_type: Database["public"]["Enums"]["position_type"]
          tier: Database["public"]["Enums"]["bonus_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          percentage?: number
          position_type: Database["public"]["Enums"]["position_type"]
          tier: Database["public"]["Enums"]["bonus_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          percentage?: number
          position_type?: Database["public"]["Enums"]["position_type"]
          tier?: Database["public"]["Enums"]["bonus_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      cargos: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_cargo"]
          created_at: string
          familia_operacional: Database["public"]["Enums"]["familia_operacional"]
          id: string
          marca_aplicavel: Json | null
          nome: string
          pote_variavel_max: number
          setor_back: Database["public"]["Enums"]["setor_back"] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["categoria_cargo"]
          created_at?: string
          familia_operacional: Database["public"]["Enums"]["familia_operacional"]
          id?: string
          marca_aplicavel?: Json | null
          nome: string
          pote_variavel_max?: number
          setor_back?: Database["public"]["Enums"]["setor_back"] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_cargo"]
          created_at?: string
          familia_operacional?: Database["public"]["Enums"]["familia_operacional"]
          id?: string
          marca_aplicavel?: Json | null
          nome?: string
          pote_variavel_max?: number
          setor_back?: Database["public"]["Enums"]["setor_back"] | null
          updated_at?: string
        }
        Relationships: []
      }
      config_funcoes: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      config_gerencias: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      config_lojas: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      freelancer_entries: {
        Row: {
          chave_pix: string
          cpf: string
          created_at: string
          created_by: string | null
          data_pop: string
          funcao: string
          gerencia: string
          id: string
          loja: string
          loja_id: string | null
          nome_completo: string
          valor: number
        }
        Insert: {
          chave_pix: string
          cpf: string
          created_at?: string
          created_by?: string | null
          data_pop: string
          funcao: string
          gerencia: string
          id?: string
          loja: string
          loja_id?: string | null
          nome_completo: string
          valor: number
        }
        Update: {
          chave_pix?: string
          cpf?: string
          created_at?: string
          created_by?: string | null
          data_pop?: string
          funcao?: string
          gerencia?: string
          id?: string
          loja?: string
          loja_id?: string | null
          nome_completo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_budgets: {
        Row: {
          budget_mensal: number
          created_at: string
          id: string
          loja_id: string | null
          updated_at: string
        }
        Insert: {
          budget_mensal?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          updated_at?: string
        }
        Update: {
          budget_mensal?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_budgets_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_entries: {
        Row: {
          anexo_url: string | null
          chave_pix: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          data_servico: string
          descricao: string | null
          fornecedor: string
          id: string
          loja: string
          loja_id: string | null
          numero_nf: string
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          chave_pix?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_servico: string
          descricao?: string | null
          fornecedor: string
          id?: string
          loja: string
          loja_id?: string | null
          numero_nf: string
          valor: number
        }
        Update: {
          anexo_url?: string | null
          chave_pix?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_servico?: string
          descricao?: string | null
          fornecedor?: string
          id?: string
          loja?: string
          loja_id?: string | null
          numero_nf?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_cargo: {
        Row: {
          ativo: boolean
          cargo_id: string
          codigo_meta: Database["public"]["Enums"]["codigo_meta"]
          created_at: string
          id: string
          origem_dado: Database["public"]["Enums"]["origem_dado"]
          peso: number
          teto_valor: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo_id: string
          codigo_meta: Database["public"]["Enums"]["codigo_meta"]
          created_at?: string
          id?: string
          origem_dado?: Database["public"]["Enums"]["origem_dado"]
          peso?: number
          teto_valor?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo_id?: string
          codigo_meta?: Database["public"]["Enums"]["codigo_meta"]
          created_at?: string
          id?: string
          origem_dado?: Database["public"]["Enums"]["origem_dado"]
          peso?: number
          teto_valor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_cargo_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_targets: {
        Row: {
          created_at: string
          id: string
          min_efficiency: number
          sector_type: Database["public"]["Enums"]["sector_type"]
          tier: Database["public"]["Enums"]["bonus_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_efficiency: number
          sector_type: Database["public"]["Enums"]["sector_type"]
          tier: Database["public"]["Enums"]["bonus_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_efficiency?: number
          sector_type?: Database["public"]["Enums"]["sector_type"]
          tier?: Database["public"]["Enums"]["bonus_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      operational_expenses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          data_despesa: string
          descricao: string | null
          id: string
          store_id: string
          valor: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          data_despesa?: string
          descricao?: string | null
          id?: string
          store_id: string
          valor: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          data_despesa?: string
          descricao?: string | null
          id?: string
          store_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamacoes: {
        Row: {
          anexo_url: string | null
          created_at: string
          created_by: string | null
          data_reclamacao: string
          fonte: string
          id: string
          is_grave: boolean | null
          loja_id: string
          nota_reclamacao: number
          palavras_chave: Json | null
          referencia_mes: string
          resumo_ia: string | null
          temas: Json | null
          texto_original: string | null
          tipo_operacao: string
          updated_at: string
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          created_by?: string | null
          data_reclamacao?: string
          fonte: string
          id?: string
          is_grave?: boolean | null
          loja_id: string
          nota_reclamacao: number
          palavras_chave?: Json | null
          referencia_mes: string
          resumo_ia?: string | null
          temas?: Json | null
          texto_original?: string | null
          tipo_operacao: string
          updated_at?: string
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          created_by?: string | null
          data_reclamacao?: string
          fonte?: string
          id?: string
          is_grave?: boolean | null
          loja_id?: string
          nota_reclamacao?: number
          palavras_chave?: Json | null
          referencia_mes?: string
          resumo_ia?: string | null
          temas?: Json | null
          texto_original?: string | null
          tipo_operacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets_sources: {
        Row: {
          ativo: boolean
          created_at: string
          gid: string | null
          id: string
          nome: string
          ultima_sincronizacao: string | null
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gid?: string | null
          id?: string
          nome: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gid?: string | null
          id?: string
          nome?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      sheets_staging: {
        Row: {
          created_at: string
          data_referencia: string
          faturamento: number
          id: string
          is_grave: boolean | null
          loja_id: string | null
          nota_reclamacao: number | null
          nps: number | null
          processed: boolean
          source_id: string
          sync_id: string | null
          tipo_operacao: string | null
          unidade_normalizada: string | null
          unidade_raw: string
        }
        Insert: {
          created_at?: string
          data_referencia: string
          faturamento?: number
          id?: string
          is_grave?: boolean | null
          loja_id?: string | null
          nota_reclamacao?: number | null
          nps?: number | null
          processed?: boolean
          source_id: string
          sync_id?: string | null
          tipo_operacao?: string | null
          unidade_normalizada?: string | null
          unidade_raw: string
        }
        Update: {
          created_at?: string
          data_referencia?: string
          faturamento?: number
          id?: string
          is_grave?: boolean | null
          loja_id?: string | null
          nota_reclamacao?: number | null
          nps?: number | null
          processed?: boolean
          source_id?: string
          sync_id?: string | null
          tipo_operacao?: string | null
          unidade_normalizada?: string | null
          unidade_raw?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_staging_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_staging_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sheets_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_staging_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "sincronizacoes_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizacoes_sheets: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          erro: string | null
          id: string
          linhas_importadas: number
          loja_id: string | null
          referencia_mes: string
          status: string
          url: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          erro?: string | null
          id?: string
          linhas_importadas?: number
          loja_id?: string | null
          referencia_mes: string
          status?: string
          url: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          erro?: string | null
          id?: string
          linhas_importadas?: number
          loja_id?: string | null
          referencia_mes?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sincronizacoes_sheets_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      store_budgets: {
        Row: {
          cleaning_budget: number
          created_at: string
          freelancer_budget: number
          id: string
          maintenance_budget: number
          month_year: string
          store_id: string
          total_budget: number | null
          uniforms_budget: number
          updated_at: string
        }
        Insert: {
          cleaning_budget?: number
          created_at?: string
          freelancer_budget?: number
          id?: string
          maintenance_budget?: number
          month_year: string
          store_id: string
          total_budget?: number | null
          uniforms_budget?: number
          updated_at?: string
        }
        Update: {
          cleaning_budget?: number
          created_at?: string
          freelancer_budget?: number
          id?: string
          maintenance_budget?: number
          month_year?: string
          store_id?: string
          total_budget?: number | null
          uniforms_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_budgets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      store_performance: {
        Row: {
          created_at: string
          faturamento: number
          id: string
          loja_id: string
          month_year: string
          nps_score: number | null
          num_reclamacoes: number
          supervisao_score: number
          tempo_comanda_avg: number | null
          tempo_prato_avg: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          faturamento?: number
          id?: string
          loja_id: string
          month_year: string
          nps_score?: number | null
          num_reclamacoes?: number
          supervisao_score?: number
          tempo_comanda_avg?: number | null
          tempo_prato_avg?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          faturamento?: number
          id?: string
          loja_id?: string
          month_year?: string
          nps_score?: number | null
          num_reclamacoes?: number
          supervisao_score?: number
          tempo_comanda_avg?: number | null
          tempo_prato_avg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_performance_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      store_performance_entries: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          faturamento_delivery: number
          faturamento_salao: number
          id: string
          loja_id: string
          notes: string | null
          reclamacoes_ifood: number
          reclamacoes_salao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          faturamento_delivery?: number
          faturamento_salao?: number
          id?: string
          loja_id: string
          notes?: string | null
          reclamacoes_ifood?: number
          reclamacoes_salao?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          faturamento_delivery?: number
          faturamento_salao?: number
          id?: string
          loja_id?: string
          notes?: string | null
          reclamacoes_ifood?: number
          reclamacoes_salao?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_performance_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_audits: {
        Row: {
          audit_date: string
          created_at: string
          created_by: string | null
          global_score: number
          id: string
          loja_id: string
          pdf_url: string | null
          processed_at: string
          updated_at: string
        }
        Insert: {
          audit_date: string
          created_at?: string
          created_by?: string | null
          global_score?: number
          id?: string
          loja_id: string
          pdf_url?: string | null
          processed_at?: string
          updated_at?: string
        }
        Update: {
          audit_date?: string
          created_at?: string
          created_by?: string | null
          global_score?: number
          id?: string
          loja_id?: string
          pdf_url?: string | null
          processed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_audits_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_failures: {
        Row: {
          audit_id: string
          category: string | null
          created_at: string
          id: string
          is_recurring: boolean
          item_name: string
          loja_id: string
          resolution_photo_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          audit_id: string
          category?: string | null
          created_at?: string
          id?: string
          is_recurring?: boolean
          item_name: string
          loja_id: string
          resolution_photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          audit_id?: string
          category?: string | null
          created_at?: string
          id?: string
          is_recurring?: boolean
          item_name?: string
          loja_id?: string
          resolution_photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervision_failures_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "supervision_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_failures_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stores: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_unidade_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      user_has_access_to_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente_unidade"
      bonus_tier: "ouro" | "prata" | "bronze" | "aceitavel"
      categoria_cargo: "gerencia" | "chefia"
      codigo_meta:
        | "nps_salao"
        | "nps_delivery"
        | "supervisao"
        | "conformidade_setor"
        | "tempo_prato"
      familia_operacional: "front" | "back"
      kpi_type: "nps" | "supervisao" | "tempo_prato" | "tempo_comanda"
      origem_dado: "sheets" | "pdf" | "kds" | "manual"
      position_type:
        | "gerente_front"
        | "gerente_back"
        | "chefia_front"
        | "chefia_back"
      sector_type: "salao" | "back" | "apv" | "delivery"
      setor_back: "cozinha" | "bar" | "parrilla" | "sushi"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente_unidade"],
      bonus_tier: ["ouro", "prata", "bronze", "aceitavel"],
      categoria_cargo: ["gerencia", "chefia"],
      codigo_meta: [
        "nps_salao",
        "nps_delivery",
        "supervisao",
        "conformidade_setor",
        "tempo_prato",
      ],
      familia_operacional: ["front", "back"],
      kpi_type: ["nps", "supervisao", "tempo_prato", "tempo_comanda"],
      origem_dado: ["sheets", "pdf", "kds", "manual"],
      position_type: [
        "gerente_front",
        "gerente_back",
        "chefia_front",
        "chefia_back",
      ],
      sector_type: ["salao", "back", "apv", "delivery"],
      setor_back: ["cozinha", "bar", "parrilla", "sushi"],
    },
  },
} as const

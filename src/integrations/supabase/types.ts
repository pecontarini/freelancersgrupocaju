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
    },
  },
} as const

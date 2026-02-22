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
      action_plan_comments: {
        Row: {
          action_plan_id: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          action_plan_id: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          action_plan_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_comments_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          acao_preventiva: string | null
          causa_raiz: string | null
          created_at: string
          created_by: string | null
          deadline_at: string
          evidencia_url: string | null
          id: string
          loja_id: string
          medida_tomada: string | null
          pain_tag: string
          referencia_mes: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["action_plan_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          acao_preventiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string
          evidencia_url?: string | null
          id?: string
          loja_id: string
          medida_tomada?: string | null
          pain_tag: string
          referencia_mes: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["action_plan_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          acao_preventiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string
          evidencia_url?: string | null
          id?: string
          loja_id?: string
          medida_tomada?: string | null
          pain_tag?: string
          referencia_mes?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["action_plan_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          id: string
          is_read: boolean
          loja_id: string
          reference_id: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          id?: string
          is_read?: boolean
          loja_id: string
          reference_id?: string | null
          severity: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          loja_id?: string
          reference_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_alerts_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sector_scores: {
        Row: {
          audit_date: string
          audit_id: string
          checklist_type: string
          created_at: string
          earned_points: number | null
          id: string
          item_count: number | null
          loja_id: string
          month_year: string
          score: number
          sector_code: string
          total_points: number | null
          updated_at: string
        }
        Insert: {
          audit_date: string
          audit_id: string
          checklist_type: string
          created_at?: string
          earned_points?: number | null
          id?: string
          item_count?: number | null
          loja_id: string
          month_year: string
          score?: number
          sector_code: string
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          audit_date?: string
          audit_id?: string
          checklist_type?: string
          created_at?: string
          earned_points?: number | null
          id?: string
          item_count?: number | null
          loja_id?: string
          month_year?: string
          score?: number
          sector_code?: string
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_sector_scores_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "supervision_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_sector_scores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_upload_logs: {
        Row: {
          audit_id: string | null
          created_at: string
          failure_count: number | null
          global_score: number | null
          id: string
          loja_id: string
          uploaded_by: string
          uploader_name: string | null
          uploader_role: string | null
          viewed_by_admin: boolean | null
        }
        Insert: {
          audit_id?: string | null
          created_at?: string
          failure_count?: number | null
          global_score?: number | null
          id?: string
          loja_id: string
          uploaded_by: string
          uploader_name?: string | null
          uploader_role?: string | null
          viewed_by_admin?: boolean | null
        }
        Update: {
          audit_id?: string | null
          created_at?: string
          failure_count?: number | null
          global_score?: number | null
          id?: string
          loja_id?: string
          uploaded_by?: string
          uploader_name?: string | null
          uploader_role?: string | null
          viewed_by_admin?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_upload_logs_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "supervision_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_upload_logs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      checklist_response_items: {
        Row: {
          created_at: string
          id: string
          is_conforming: boolean
          observation: string | null
          photo_url: string | null
          response_id: string
          template_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_conforming?: boolean
          observation?: string | null
          photo_url?: string | null
          response_id: string
          template_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_conforming?: boolean
          observation?: string | null
          photo_url?: string | null
          response_id?: string
          template_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_response_items_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "checklist_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_response_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          conforming_items: number
          created_at: string
          id: string
          link_id: string
          loja_id: string
          responded_by_name: string | null
          response_date: string
          sector_code: string
          total_items: number
          total_score: number
        }
        Insert: {
          conforming_items?: number
          created_at?: string
          id?: string
          link_id: string
          loja_id: string
          responded_by_name?: string | null
          response_date?: string
          sector_code: string
          total_items?: number
          total_score?: number
        }
        Update: {
          conforming_items?: number
          created_at?: string
          id?: string
          link_id?: string
          loja_id?: string
          responded_by_name?: string | null
          response_date?: string
          sector_code?: string
          total_items?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "checklist_sector_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sector_links: {
        Row: {
          access_token: string
          created_at: string
          id: string
          is_active: boolean
          loja_id: string
          sector_code: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          loja_id: string
          sector_code: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          loja_id?: string
          sector_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sector_links_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          id: string
          item_order: number
          item_text: string
          original_category: string | null
          sector_code: string | null
          template_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_order?: number
          item_text: string
          original_category?: string | null
          sector_code?: string | null
          template_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_order?: number
          item_text?: string
          original_category?: string | null
          sector_code?: string | null
          template_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          loja_id: string
          name: string
          source_pdf_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loja_id: string
          name: string
          source_pdf_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loja_id?: string
          name?: string
          source_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_contagens: {
        Row: {
          cmv_item_id: string
          created_at: string
          created_by: string | null
          data_contagem: string
          id: string
          loja_id: string
          preco_custo_snapshot: number
          quantidade: number
          updated_at: string
        }
        Insert: {
          cmv_item_id: string
          created_at?: string
          created_by?: string | null
          data_contagem: string
          id?: string
          loja_id: string
          preco_custo_snapshot: number
          quantidade?: number
          updated_at?: string
        }
        Update: {
          cmv_item_id?: string
          created_at?: string
          created_by?: string | null
          data_contagem?: string
          id?: string
          loja_id?: string
          preco_custo_snapshot?: number
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_contagens_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_contagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_ignored_items: {
        Row: {
          created_at: string
          id: string
          ignored_by: string | null
          item_name: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ignored_by?: string | null
          item_name: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ignored_by?: string | null
          item_name?: string
          reason?: string | null
        }
        Relationships: []
      }
      cmv_inventory: {
        Row: {
          cmv_item_id: string
          id: string
          loja_id: string
          quantidade_atual: number
          ultima_contagem: string | null
          updated_at: string
        }
        Insert: {
          cmv_item_id: string
          id?: string
          loja_id: string
          quantidade_atual?: number
          ultima_contagem?: string | null
          updated_at?: string
        }
        Update: {
          cmv_item_id?: string
          id?: string
          loja_id?: string
          quantidade_atual?: number
          ultima_contagem?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_inventory_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_inventory_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_items: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          id: string
          nome: string
          peso_padrao_g: number | null
          preco_custo_atual: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          peso_padrao_g?: number | null
          preco_custo_atual?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
          peso_padrao_g?: number | null
          preco_custo_atual?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      cmv_movements: {
        Row: {
          cmv_item_id: string
          created_at: string
          created_by: string | null
          data_movimento: string
          id: string
          loja_id: string
          preco_unitario: number | null
          quantidade: number
          referencia: string | null
          tipo_movimento: string
        }
        Insert: {
          cmv_item_id: string
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          id?: string
          loja_id: string
          preco_unitario?: number | null
          quantidade: number
          referencia?: string | null
          tipo_movimento: string
        }
        Update: {
          cmv_item_id?: string
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          id?: string
          loja_id?: string
          preco_unitario?: number | null
          quantidade?: number
          referencia?: string | null
          tipo_movimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_movements_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_movements_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_nfe_mappings: {
        Row: {
          cmv_item_id: string
          created_at: string
          id: string
          nome_nfe_normalizado: string
          nome_nfe_original: string
          updated_at: string
        }
        Insert: {
          cmv_item_id: string
          created_at?: string
          id?: string
          nome_nfe_normalizado: string
          nome_nfe_original: string
          updated_at?: string
        }
        Update: {
          cmv_item_id?: string
          created_at?: string
          id?: string
          nome_nfe_normalizado?: string
          nome_nfe_original?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_nfe_mappings_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_pending_sales_items: {
        Row: {
          created_at: string
          id: string
          loja_id: string | null
          nome_venda_normalizado: string
          nome_venda_original: string
          primeira_ocorrencia: string
          status: string
          total_ocorrencias: number
          ultima_ocorrencia: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id?: string | null
          nome_venda_normalizado: string
          nome_venda_original: string
          primeira_ocorrencia?: string
          status?: string
          total_ocorrencias?: number
          ultima_ocorrencia?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string | null
          nome_venda_normalizado?: string
          nome_venda_original?: string
          primeira_ocorrencia?: string
          status?: string
          total_ocorrencias?: number
          ultima_ocorrencia?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_pending_sales_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_price_history: {
        Row: {
          cmv_item_id: string
          created_at: string
          created_by: string | null
          fonte: string
          id: string
          preco_anterior: number
          preco_novo: number
          referencia_nf: string | null
        }
        Insert: {
          cmv_item_id: string
          created_at?: string
          created_by?: string | null
          fonte?: string
          id?: string
          preco_anterior: number
          preco_novo: number
          referencia_nf?: string | null
        }
        Update: {
          cmv_item_id?: string
          created_at?: string
          created_by?: string | null
          fonte?: string
          id?: string
          preco_anterior?: number
          preco_novo?: number
          referencia_nf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_price_history_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_sales_mappings: {
        Row: {
          cmv_item_id: string
          created_at: string
          id: string
          is_global: boolean
          multiplicador: number
          nome_venda: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          cmv_item_id: string
          created_at?: string
          id?: string
          is_global?: boolean
          multiplicador?: number
          nome_venda: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          cmv_item_id?: string
          created_at?: string
          id?: string
          is_global?: boolean
          multiplicador?: number
          nome_venda?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_sales_mappings_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
        ]
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
      daily_budgets: {
        Row: {
          budget_amount: number
          created_at: string
          date: string
          id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number
          created_at?: string
          date: string
          id?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number
          created_at?: string
          date?: string
          id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_budgets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          created_at: string
          id: string
          item_name: string
          quantity: number
          sale_date: string
          total_amount: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          quantity?: number
          sale_date: string
          total_amount?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          quantity?: number
          sale_date?: string
          total_amount?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stock_positions: {
        Row: {
          created_at: string
          date: string
          divergence: number | null
          id: string
          ingredient_id: string
          opening_balance: number
          physical_count: number | null
          theoretical_balance: number
          total_entry: number
          total_sales: number
          total_waste: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          divergence?: number | null
          id?: string
          ingredient_id: string
          opening_balance?: number
          physical_count?: number | null
          theoretical_balance?: number
          total_entry?: number
          total_sales?: number
          total_waste?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          divergence?: number | null
          id?: string
          ingredient_id?: string
          opening_balance?: number
          physical_count?: number | null
          theoretical_balance?: number
          total_entry?: number
          total_sales?: number
          total_waste?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stock_positions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_stock_positions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          default_rate: number | null
          gender: string
          id: string
          job_title: string | null
          job_title_id: string | null
          name: string
          phone: string | null
          unit_id: string
          updated_at: string
          worker_type: Database["public"]["Enums"]["worker_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_rate?: number | null
          gender?: string
          id?: string
          job_title?: string | null
          job_title_id?: string | null
          name: string
          phone?: string | null
          unit_id: string
          updated_at?: string
          worker_type?: Database["public"]["Enums"]["worker_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          default_rate?: number | null
          gender?: string
          id?: string
          job_title?: string | null
          job_title_id?: string | null
          name?: string
          phone?: string | null
          unit_id?: string
          updated_at?: string
          worker_type?: Database["public"]["Enums"]["worker_type"]
        }
        Relationships: [
          {
            foreignKeyName: "employees_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
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
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          reference_id: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      job_titles: {
        Row: {
          created_at: string
          id: string
          name: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_titles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_calculation_log: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          loja_id: string | null
          month_year: string | null
          positions_updated: number | null
          started_at: string
          status: string
          stores_updated: number | null
          trigger_audit_id: string | null
          trigger_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          loja_id?: string | null
          month_year?: string | null
          positions_updated?: number | null
          started_at?: string
          status?: string
          stores_updated?: number | null
          trigger_audit_id?: string | null
          trigger_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          loja_id?: string | null
          month_year?: string | null
          positions_updated?: number | null
          started_at?: string
          status?: string
          stores_updated?: number | null
          trigger_audit_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_calculation_log_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leadership_calculation_log_trigger_audit_id_fkey"
            columns: ["trigger_audit_id"]
            isOneToOne: false
            referencedRelation: "supervision_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_performance_scores: {
        Row: {
          breakdown: Json | null
          calculated_at: string
          created_at: string
          final_score: number | null
          id: string
          loja_id: string
          month_year: string
          needs_review: boolean | null
          position_code: string
          review_reasons: Json | null
          tier: string | null
          total_audits: number | null
          updated_at: string
        }
        Insert: {
          breakdown?: Json | null
          calculated_at?: string
          created_at?: string
          final_score?: number | null
          id?: string
          loja_id: string
          month_year: string
          needs_review?: boolean | null
          position_code: string
          review_reasons?: Json | null
          tier?: string | null
          total_audits?: number | null
          updated_at?: string
        }
        Update: {
          breakdown?: Json | null
          calculated_at?: string
          created_at?: string
          final_score?: number | null
          id?: string
          loja_id?: string
          month_year?: string
          needs_review?: boolean | null
          position_code?: string
          review_reasons?: Json | null
          tier?: string | null
          total_audits?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_performance_scores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      leadership_store_scores: {
        Row: {
          back_failures: number | null
          back_score: number | null
          back_tier: string | null
          calculated_at: string
          created_at: string
          front_failures: number | null
          front_score: number | null
          front_tier: string | null
          general_score: number | null
          general_tier: string | null
          id: string
          loja_id: string
          month_year: string
          total_audits: number | null
          total_failures: number | null
          updated_at: string
        }
        Insert: {
          back_failures?: number | null
          back_score?: number | null
          back_tier?: string | null
          calculated_at?: string
          created_at?: string
          front_failures?: number | null
          front_score?: number | null
          front_tier?: string | null
          general_score?: number | null
          general_tier?: string | null
          id?: string
          loja_id: string
          month_year: string
          total_audits?: number | null
          total_failures?: number | null
          updated_at?: string
        }
        Update: {
          back_failures?: number | null
          back_score?: number | null
          back_tier?: string | null
          calculated_at?: string
          created_at?: string
          front_failures?: number | null
          front_score?: number | null
          front_tier?: string | null
          general_score?: number | null
          general_tier?: string | null
          id?: string
          loja_id?: string
          month_year?: string
          total_audits?: number | null
          total_failures?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leadership_store_scores_loja_id_fkey"
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
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          employee_id: string
          id: string
          message_body: string | null
          notification_date: string
          schedule_id: string
          sent_at: string
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          employee_id: string
          id?: string
          message_body?: string | null
          notification_date?: string
          schedule_id: string
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          employee_id?: string
          id?: string
          message_body?: string | null
          notification_date?: string
          schedule_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
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
      schedule_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          employee_id: string
          id: string
          justificativa: string | null
          notas: string | null
          remanejado_de_sector_id: string | null
          remanejado_para_sector_id: string | null
          schedule_id: string
          sector_id: string
          shift_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          employee_id: string
          id?: string
          justificativa?: string | null
          notas?: string | null
          remanejado_de_sector_id?: string | null
          remanejado_para_sector_id?: string | null
          schedule_id: string
          sector_id: string
          shift_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          justificativa?: string | null
          notas?: string | null
          remanejado_de_sector_id?: string | null
          remanejado_para_sector_id?: string | null
          schedule_id?: string
          sector_id?: string
          shift_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_attendance_remanejado_de_sector_id_fkey"
            columns: ["remanejado_de_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_attendance_remanejado_para_sector_id_fkey"
            columns: ["remanejado_para_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_attendance_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          agreed_rate: number | null
          break_duration: number
          confirmation_responded_at: string | null
          confirmation_status: string | null
          created_at: string
          denial_reason: string | null
          employee_id: string | null
          end_time: string | null
          id: string
          schedule_date: string
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          sector_id: string
          shift_id: string
          start_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_rate?: number | null
          break_duration?: number
          confirmation_responded_at?: string | null
          confirmation_status?: string | null
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          schedule_date: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          sector_id: string
          shift_id: string
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_rate?: number | null
          break_duration?: number
          confirmation_responded_at?: string | null
          confirmation_status?: string | null
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          schedule_date?: string
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          sector_id?: string
          shift_id?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_job_titles: {
        Row: {
          created_at: string
          id: string
          job_title_id: string
          sector_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_title_id: string
          sector_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_title_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_job_titles_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_job_titles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_unit_id_fkey"
            columns: ["unit_id"]
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
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          type: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          type?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          type?: string
        }
        Relationships: []
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
      staffing_matrix: {
        Row: {
          created_at: string
          day_of_week: number
          extras_count: number
          id: string
          required_count: number
          sector_id: string
          shift_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          extras_count?: number
          id?: string
          required_count?: number
          sector_id: string
          shift_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          extras_count?: number
          id?: string
          required_count?: number
          sector_id?: string
          shift_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_matrix_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
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
          utensils_budget: number
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
          utensils_budget?: number
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
          utensils_budget?: number
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
          detalhes_falha: string | null
          id: string
          is_recurring: boolean
          item_name: string
          loja_id: string
          resolution_photo_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          url_foto_evidencia: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          audit_id: string
          category?: string | null
          created_at?: string
          detalhes_falha?: string | null
          id?: string
          is_recurring?: boolean
          item_name: string
          loja_id: string
          resolution_photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          url_foto_evidencia?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          audit_id?: string
          category?: string | null
          created_at?: string
          detalhes_falha?: string | null
          id?: string
          is_recurring?: boolean
          item_name?: string
          loja_id?: string
          resolution_photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          url_foto_evidencia?: string | null
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
      build_daily_stock_snapshot: {
        Args: { p_date: string; p_unit_id: string }
        Returns: undefined
      }
      calculate_audit_period: {
        Args: { p_end_date: string; p_loja_id: string; p_start_date: string }
        Returns: {
          categoria: string
          divergence: number
          final_cost: number
          financial_loss: number
          has_final_count: boolean
          has_initial_count: boolean
          initial_cost: number
          initial_stock: number
          item_id: string
          item_name: string
          purchases_qty: number
          real_final_stock: number
          sales_consumption: number
          theoretical_final: number
          transfers_qty: number
          unidade: string
          waste_qty: number
        }[]
      }
      compute_kardex_daily: {
        Args: {
          p_end_date: string
          p_ingredient_id: string
          p_start_date: string
          p_unit_id: string
        }
        Returns: {
          day: string
          divergence: number
          opening_balance: number
          physical_count: number
          theoretical_balance: number
          total_entry: number
          total_sales: number
          total_waste: number
        }[]
      }
      get_realtime_stock_positions: {
        Args: { p_unit_id: string }
        Returns: {
          categoria: string
          current_qty: number
          current_value: number
          days_since_count: number
          entries_qty: number
          exits_qty: number
          item_id: string
          item_name: string
          last_count_date: string
          last_count_qty: number
          preco_custo_atual: number
          unidade: string
        }[]
      }
      get_user_unidade_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      normalize_sales_item_name: { Args: { name: string }; Returns: string }
      reset_unit_sales_data: { Args: { target_unit_id: string }; Returns: Json }
      user_has_access_to_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      validate_schedule_clt: {
        Args: {
          p_employee_id: string
          p_schedule_date: string
          p_sector_id: string
          p_shift_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      action_plan_status: "pending" | "in_analysis" | "resolved"
      app_role:
        | "admin"
        | "gerente_unidade"
        | "partner"
        | "chefe_setor"
        | "operator"
        | "employee"
      bonus_tier: "ouro" | "prata" | "bronze" | "aceitavel"
      categoria_cargo: "gerencia" | "chefia"
      codigo_meta:
        | "nps_salao"
        | "nps_delivery"
        | "supervisao"
        | "conformidade_setor"
        | "tempo_prato"
      familia_operacional: "front" | "back"
      inventory_transaction_type:
        | "purchase"
        | "sale_deduction"
        | "waste"
        | "audit_adjustment"
        | "transfer_in"
        | "transfer_out"
      kpi_type: "nps" | "supervisao" | "tempo_prato" | "tempo_comanda"
      origem_dado: "sheets" | "pdf" | "kds" | "manual"
      position_type:
        | "gerente_front"
        | "gerente_back"
        | "chefia_front"
        | "chefia_back"
      schedule_type: "working" | "off" | "vacation" | "sick_leave"
      sector_type: "salao" | "back" | "apv" | "delivery"
      setor_back: "cozinha" | "bar" | "parrilla" | "sushi"
      worker_type: "clt" | "freelancer"
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
      action_plan_status: ["pending", "in_analysis", "resolved"],
      app_role: [
        "admin",
        "gerente_unidade",
        "partner",
        "chefe_setor",
        "operator",
        "employee",
      ],
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
      inventory_transaction_type: [
        "purchase",
        "sale_deduction",
        "waste",
        "audit_adjustment",
        "transfer_in",
        "transfer_out",
      ],
      kpi_type: ["nps", "supervisao", "tempo_prato", "tempo_comanda"],
      origem_dado: ["sheets", "pdf", "kds", "manual"],
      position_type: [
        "gerente_front",
        "gerente_back",
        "chefia_front",
        "chefia_back",
      ],
      schedule_type: ["working", "off", "vacation", "sick_leave"],
      sector_type: ["salao", "back", "apv", "delivery"],
      setor_back: ["cozinha", "bar", "parrilla", "sushi"],
      worker_type: ["clt", "freelancer"],
    },
  },
} as const

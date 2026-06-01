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
      _backup_employees_pre_secullum: {
        Row: {
          active: boolean | null
          cpf: string | null
          created_at: string | null
          data_backup: string | null
          default_rate: number | null
          gender: string | null
          id: string | null
          job_title: string | null
          job_title_id: string | null
          name: string | null
          phone: string | null
          unit_id: string | null
          updated_at: string | null
          worker_type: Database["public"]["Enums"]["worker_type"] | null
        }
        Insert: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          data_backup?: string | null
          default_rate?: number | null
          gender?: string | null
          id?: string | null
          job_title?: string | null
          job_title_id?: string | null
          name?: string | null
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Update: {
          active?: boolean | null
          cpf?: string | null
          created_at?: string | null
          data_backup?: string | null
          default_rate?: number | null
          gender?: string | null
          id?: string | null
          job_title?: string | null
          job_title_id?: string | null
          name?: string | null
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Relationships: []
      }
      _backup_job_titles_dedup_21mai_2026: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string | null
          is_canonical: boolean | null
          name: string | null
          unit_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          is_canonical?: boolean | null
          name?: string | null
          unit_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          is_canonical?: boolean | null
          name?: string | null
          unit_id?: string | null
        }
        Relationships: []
      }
      _backup_job_titles_lixos_21mai_2026: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string | null
          is_canonical: boolean | null
          name: string | null
          unit_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          is_canonical?: boolean | null
          name?: string | null
          unit_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string | null
          is_canonical?: boolean | null
          name?: string | null
          unit_id?: string | null
        }
        Relationships: []
      }
      _backup_orfaos_20mai_2026: {
        Row: {
          active: boolean | null
          aguardando_secullum: boolean | null
          backup_em: string | null
          backup_motivo: string | null
          banco_id: number | null
          cpf: string | null
          created_at: string | null
          default_rate: number | null
          gender: string | null
          id: string | null
          job_title: string | null
          job_title_id: string | null
          name: string | null
          phone: string | null
          secullum_id: number | null
          sincronizado_em: string | null
          unit_id: string | null
          updated_at: string | null
          worker_type: Database["public"]["Enums"]["worker_type"] | null
        }
        Insert: {
          active?: boolean | null
          aguardando_secullum?: boolean | null
          backup_em?: string | null
          backup_motivo?: string | null
          banco_id?: number | null
          cpf?: string | null
          created_at?: string | null
          default_rate?: number | null
          gender?: string | null
          id?: string | null
          job_title?: string | null
          job_title_id?: string | null
          name?: string | null
          phone?: string | null
          secullum_id?: number | null
          sincronizado_em?: string | null
          unit_id?: string | null
          updated_at?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Update: {
          active?: boolean | null
          aguardando_secullum?: boolean | null
          backup_em?: string | null
          backup_motivo?: string | null
          banco_id?: number | null
          cpf?: string | null
          created_at?: string | null
          default_rate?: number | null
          gender?: string | null
          id?: string | null
          job_title?: string | null
          job_title_id?: string | null
          name?: string | null
          phone?: string | null
          secullum_id?: number | null
          sincronizado_em?: string | null
          unit_id?: string | null
          updated_at?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Relationships: []
      }
      _backup_sectors_dedup_20mai_2026: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          unit_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          unit_id?: string | null
        }
        Relationships: []
      }
      _backup_staffing_matrix_dedup_20mai_2026: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          extras_count: number | null
          id: string | null
          required_count: number | null
          sector_id: string | null
          shift_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          extras_count?: number | null
          id?: string | null
          required_count?: number | null
          sector_id?: string | null
          shift_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          extras_count?: number | null
          id?: string | null
          required_count?: number | null
          sector_id?: string | null
          shift_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _sprint0_sheets_sources_backup: {
        Row: {
          ativo: boolean | null
          backup_at: string | null
          created_at: string | null
          gid: string | null
          id: string | null
          meta_key: string | null
          nome: string | null
          sync_diario: boolean | null
          tipo_dado: Database["public"]["Enums"]["import_destino"] | null
          ultima_execucao_cron: string | null
          ultima_sincronizacao: string | null
          ultimo_erro: string | null
          ultimo_status: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          ativo?: boolean | null
          backup_at?: string | null
          created_at?: string | null
          gid?: string | null
          id?: string | null
          meta_key?: string | null
          nome?: string | null
          sync_diario?: boolean | null
          tipo_dado?: Database["public"]["Enums"]["import_destino"] | null
          ultima_execucao_cron?: string | null
          ultima_sincronizacao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          ativo?: boolean | null
          backup_at?: string | null
          created_at?: string | null
          gid?: string | null
          id?: string | null
          meta_key?: string | null
          nome?: string | null
          sync_diario?: boolean | null
          tipo_dado?: Database["public"]["Enums"]["import_destino"] | null
          ultima_execucao_cron?: string | null
          ultima_sincronizacao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "action_plans_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      agenda_eventos: {
        Row: {
          categoria: string
          concluido: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          google_event_id: string | null
          id: string
          participantes: Json
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          concluido?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          participantes?: Json
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          concluido?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          google_event_id?: string | null
          id?: string
          participantes?: Json
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_draft_slots: {
        Row: {
          created_at: string
          created_by: string | null
          days: Json
          id: string
          label: string
          responsavel: boolean
          sector_id: string
          tipo: string
          unit_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days?: Json
          id?: string
          label: string
          responsavel?: boolean
          sector_id: string
          tipo: string
          unit_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: Json
          id?: string
          label?: string
          responsavel?: boolean
          sector_id?: string
          tipo?: string
          unit_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "audit_alerts_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "audit_sector_scores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "audit_upload_logs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "avaliacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "bonus_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
      bulk_import_logs: {
        Row: {
          arquivo_nome: string | null
          draft_id: string | null
          erros: Json
          id: string
          imported_at: string
          imported_by: string | null
          status: string
          total_erro: number
          total_linhas: number
          total_sucesso: number
          unit_id: string
          week_start_date: string
        }
        Insert: {
          arquivo_nome?: string | null
          draft_id?: string | null
          erros?: Json
          id?: string
          imported_at?: string
          imported_by?: string | null
          status: string
          total_erro?: number
          total_linhas?: number
          total_sucesso?: number
          unit_id: string
          week_start_date: string
        }
        Update: {
          arquivo_nome?: string | null
          draft_id?: string | null
          erros?: Json
          id?: string
          imported_at?: string
          imported_by?: string | null
          status?: string
          total_erro?: number
          total_linhas?: number
          total_sucesso?: number
          unit_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_import_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      cargo_aliases: {
        Row: {
          cargo_texto: string
          categoria: string
          created_at: string
          id: string
          nome_canonico: string | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          cargo_texto: string
          categoria: string
          created_at?: string
          id?: string
          nome_canonico?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          cargo_texto?: string
          categoria?: string
          created_at?: string
          id?: string
          nome_canonico?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cargo_aliases_pendentes: {
        Row: {
          cargo_texto: string
          first_seen: string
          id: string
          last_seen: string
          notas: string | null
          qtd_funcionarios: number
          revisado: boolean
          unit_id: string | null
        }
        Insert: {
          cargo_texto: string
          first_seen?: string
          id?: string
          last_seen?: string
          notas?: string | null
          qtd_funcionarios?: number
          revisado?: boolean
          unit_id?: string | null
        }
        Update: {
          cargo_texto?: string
          first_seen?: string
          id?: string
          last_seen?: string
          notas?: string | null
          qtd_funcionarios?: number
          revisado?: boolean
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_aliases_pendentes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_aliases_pendentes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
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
      checkin_approvals: {
        Row: {
          approval_date: string
          approved_at: string
          approved_by: string
          checkin_ids: string[]
          created_at: string
          id: string
          loja_id: string
          pin_hash: string | null
        }
        Insert: {
          approval_date: string
          approved_at?: string
          approved_by: string
          checkin_ids?: string[]
          created_at?: string
          id?: string
          loja_id: string
          pin_hash?: string | null
        }
        Update: {
          approval_date?: string
          approved_at?: string
          approved_by?: string
          checkin_ids?: string[]
          created_at?: string
          id?: string
          loja_id?: string
          pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_approvals_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_approvals_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      checkin_budget_entries: {
        Row: {
          approval_id: string | null
          chave_pix: string | null
          checkin_at: string
          checkin_id: string
          checkout_at: string | null
          cpf: string
          created_at: string
          data_servico: string
          freelancer_name: string
          id: string
          loja_id: string
          pix_snapshot: Json | null
          signed_at: string
          signed_by: string
          tipo_chave_pix: string | null
          valor: number
        }
        Insert: {
          approval_id?: string | null
          chave_pix?: string | null
          checkin_at: string
          checkin_id: string
          checkout_at?: string | null
          cpf: string
          created_at?: string
          data_servico: string
          freelancer_name: string
          id?: string
          loja_id: string
          pix_snapshot?: Json | null
          signed_at?: string
          signed_by: string
          tipo_chave_pix?: string | null
          valor: number
        }
        Update: {
          approval_id?: string | null
          chave_pix?: string | null
          checkin_at?: string
          checkin_id?: string
          checkout_at?: string | null
          cpf?: string
          created_at?: string
          data_servico?: string
          freelancer_name?: string
          id?: string
          loja_id?: string
          pix_snapshot?: Json | null
          signed_at?: string
          signed_by?: string
          tipo_chave_pix?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkin_budget_entries_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "checkin_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_budget_entries_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: true
            referencedRelation: "freelancer_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_budget_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_budget_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      checkin_stations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_seen_at: string | null
          loja_id: string
          pin_hash: string
          station_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          loja_id: string
          pin_hash: string
          station_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_seen_at?: string | null
          loja_id?: string
          pin_hash?: string
          station_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_stations_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_stations_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      checklist_corrections: {
        Row: {
          corrected_at: string
          corrected_by_name: string
          correction_note: string | null
          correction_photo_url: string
          created_at: string
          id: string
          loja_id: string
          response_id: string
          response_item_id: string
        }
        Insert: {
          corrected_at?: string
          corrected_by_name: string
          correction_note?: string | null
          correction_photo_url: string
          created_at?: string
          id?: string
          loja_id: string
          response_id: string
          response_item_id: string
        }
        Update: {
          corrected_at?: string
          corrected_by_name?: string
          correction_note?: string | null
          correction_photo_url?: string
          created_at?: string
          id?: string
          loja_id?: string
          response_id?: string
          response_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_corrections_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_corrections_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "checklist_corrections_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "checklist_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_corrections_response_item_id_fkey"
            columns: ["response_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_response_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_response_items: {
        Row: {
          created_at: string
          id: string
          is_conforming: boolean
          is_na: boolean
          observation: string | null
          photo_url: string | null
          response_id: string
          template_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_conforming?: boolean
          is_na?: boolean
          observation?: string | null
          photo_url?: string | null
          response_id: string
          template_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_conforming?: boolean
          is_na?: boolean
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
          template_id: string | null
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
          template_id?: string | null
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
          template_id?: string | null
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
          {
            foreignKeyName: "checklist_responses_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "checklist_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
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
          template_id: string | null
        }
        Insert: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          loja_id: string
          sector_code: string
          template_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          loja_id?: string
          sector_code?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sector_links_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_sector_links_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "checklist_sector_links_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
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
          canonical_template_id: string | null
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          deprecated_reason: string | null
          id: string
          is_active: boolean
          loja_id: string
          name: string
          source_pdf_url: string | null
        }
        Insert: {
          canonical_template_id?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_reason?: string | null
          id?: string
          is_active?: boolean
          loja_id: string
          name: string
          source_pdf_url?: string | null
        }
        Update: {
          canonical_template_id?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecated_reason?: string | null
          id?: string
          is_active?: boolean
          loja_id?: string
          name?: string
          source_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_canonical_template_id_fkey"
            columns: ["canonical_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      cmv_camara: {
        Row: {
          cmv_item_id: string
          created_at: string | null
          dia: string
          entrada: number | null
          id: string
          saida: number | null
          semana_id: string
          updated_at: string | null
        }
        Insert: {
          cmv_item_id: string
          created_at?: string | null
          dia: string
          entrada?: number | null
          id?: string
          saida?: number | null
          semana_id: string
          updated_at?: string | null
        }
        Update: {
          cmv_item_id?: string
          created_at?: string | null
          dia?: string
          entrada?: number | null
          id?: string
          saida?: number | null
          semana_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_camara_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_camara_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas_cmv"
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
          {
            foreignKeyName: "cmv_contagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "cmv_inventory_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "cmv_movements_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "cmv_pending_sales_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      cmv_praca: {
        Row: {
          cmv_item_id: string
          created_at: string | null
          dia: string
          id: string
          semana_id: string
          t1_abertura: number | null
          t2_almoco: number | null
          t3_fechamento: number | null
          turno_encerrado_em: string | null
          updated_at: string | null
        }
        Insert: {
          cmv_item_id: string
          created_at?: string | null
          dia: string
          id?: string
          semana_id: string
          t1_abertura?: number | null
          t2_almoco?: number | null
          t3_fechamento?: number | null
          turno_encerrado_em?: string | null
          updated_at?: string | null
        }
        Update: {
          cmv_item_id?: string
          created_at?: string | null
          dia?: string
          id?: string
          semana_id?: string
          t1_abertura?: number | null
          t2_almoco?: number | null
          t3_fechamento?: number | null
          turno_encerrado_em?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_praca_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_praca_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas_cmv"
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
      cmv_vendas_ajuste: {
        Row: {
          cmv_item_id: string
          created_at: string | null
          dia: string
          id: string
          notas: string | null
          quantidade_manual: number | null
          semana_id: string
          updated_at: string | null
        }
        Insert: {
          cmv_item_id: string
          created_at?: string | null
          dia: string
          id?: string
          notas?: string | null
          quantidade_manual?: number | null
          semana_id: string
          updated_at?: string | null
        }
        Update: {
          cmv_item_id?: string
          created_at?: string | null
          dia?: string
          id?: string
          notas?: string | null
          quantidade_manual?: number | null
          semana_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_vendas_ajuste_cmv_item_id_fkey"
            columns: ["cmv_item_id"]
            isOneToOne: false
            referencedRelation: "cmv_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmv_vendas_ajuste_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "semanas_cmv"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpj_administrativo: {
        Row: {
          cnpj: string
          created_at: string
          holding_principal: string
          id: number
          notas: string | null
          razao_social: string
          tipo: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          holding_principal: string
          id?: number
          notas?: string | null
          razao_social: string
          tipo: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          holding_principal?: string
          id?: number
          notas?: string | null
          razao_social?: string
          tipo?: string
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
          brand: string | null
          cnpj: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          nome: string
          pin_contagem: string | null
        }
        Insert: {
          brand?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          pin_contagem?: string | null
        }
        Update: {
          brand?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          pin_contagem?: string | null
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
          {
            foreignKeyName: "daily_budgets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "daily_sales_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "daily_stock_positions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      employee_merge_log: {
        Row: {
          canonico_id: string
          canonico_name: string
          canonico_secullum_id: number | null
          duplicata_id: string
          duplicata_name: string
          duplicata_secullum_id: number | null
          executado_em: string
          id: string
          motivo: string | null
          payload_extra: Json | null
          schedules_deletadas: number
          schedules_remapeadas: number
          time_punches_deletados: number
          time_punches_remapeados: number
        }
        Insert: {
          canonico_id: string
          canonico_name: string
          canonico_secullum_id?: number | null
          duplicata_id: string
          duplicata_name: string
          duplicata_secullum_id?: number | null
          executado_em?: string
          id?: string
          motivo?: string | null
          payload_extra?: Json | null
          schedules_deletadas?: number
          schedules_remapeadas?: number
          time_punches_deletados?: number
          time_punches_remapeados?: number
        }
        Update: {
          canonico_id?: string
          canonico_name?: string
          canonico_secullum_id?: number | null
          duplicata_id?: string
          duplicata_name?: string
          duplicata_secullum_id?: number | null
          executado_em?: string
          id?: string
          motivo?: string | null
          payload_extra?: Json | null
          schedules_deletadas?: number
          schedules_remapeadas?: number
          time_punches_deletados?: number
          time_punches_remapeados?: number
        }
        Relationships: []
      }
      employee_remap_log: {
        Row: {
          acao: string
          canon_employee_id: string | null
          created_at: string
          fase: string
          id: number
          orph_cpf: string | null
          orph_employee_id: string
          orph_name: string | null
          schedule_date: string | null
          schedule_id: string
          sector_id: string | null
          unit_id: string | null
        }
        Insert: {
          acao: string
          canon_employee_id?: string | null
          created_at?: string
          fase?: string
          id?: number
          orph_cpf?: string | null
          orph_employee_id: string
          orph_name?: string | null
          schedule_date?: string | null
          schedule_id: string
          sector_id?: string | null
          unit_id?: string | null
        }
        Update: {
          acao?: string
          canon_employee_id?: string | null
          created_at?: string
          fase?: string
          id?: number
          orph_cpf?: string | null
          orph_employee_id?: string
          orph_name?: string | null
          schedule_date?: string | null
          schedule_id?: string
          sector_id?: string | null
          unit_id?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          aguardando_secullum: boolean | null
          banco_id: number | null
          cpf: string | null
          created_at: string
          default_rate: number | null
          gender: string
          id: string
          job_title: string | null
          job_title_id: string | null
          name: string
          phone: string | null
          secullum_id: number | null
          sincronizado_em: string | null
          unit_id: string
          updated_at: string
          worker_type: Database["public"]["Enums"]["worker_type"]
        }
        Insert: {
          active?: boolean
          aguardando_secullum?: boolean | null
          banco_id?: number | null
          cpf?: string | null
          created_at?: string
          default_rate?: number | null
          gender?: string
          id?: string
          job_title?: string | null
          job_title_id?: string | null
          name: string
          phone?: string | null
          secullum_id?: number | null
          sincronizado_em?: string | null
          unit_id: string
          updated_at?: string
          worker_type?: Database["public"]["Enums"]["worker_type"]
        }
        Update: {
          active?: boolean
          aguardando_secullum?: boolean | null
          banco_id?: number | null
          cpf?: string | null
          created_at?: string
          default_rate?: number | null
          gender?: string
          id?: string
          job_title?: string | null
          job_title_id?: string | null
          name?: string
          phone?: string | null
          secullum_id?: number | null
          sincronizado_em?: string | null
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
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      escala_aprovacao_links: {
        Row: {
          criado_em: string
          criado_por: string | null
          decisao: string | null
          expira_em: string
          id: string
          ip_aprovador: string | null
          template_id: string
          token: string
          usado_em: string | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          decisao?: string | null
          expira_em?: string
          id?: string
          ip_aprovador?: string | null
          template_id: string
          token: string
          usado_em?: string | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          decisao?: string | null
          expira_em?: string
          id?: string
          ip_aprovador?: string | null
          template_id?: string
          token?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_aprovacao_links_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "escala_template"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_minima: {
        Row: {
          created_at: string
          dia_semana: string
          id: string
          qtd_efetivos: number
          qtd_extras: number
          setor: string
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          id?: string
          qtd_efetivos?: number
          qtd_extras?: number
          setor: string
          turno: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          id?: string
          qtd_efetivos?: number
          qtd_extras?: number
          setor?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_minima_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_minima_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      escala_template: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          comentario_rejeicao: string | null
          created_at: string
          gerado_em: string
          id: string
          payload: Json
          semana_inicio: string
          setor: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          comentario_rejeicao?: string | null
          created_at?: string
          gerado_em?: string
          id?: string
          payload: Json
          semana_inicio: string
          setor: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          comentario_rejeicao?: string | null
          created_at?: string
          gerado_em?: string
          id?: string
          payload?: Json
          semana_inicio?: string
          setor?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_template_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_template_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      escala_vinculacao: {
        Row: {
          created_at: string
          dia_semana: string
          funcionario_id: string
          id: string
          observacao: string | null
          template_id: string
          tipo_dia: string
          tipo_turno: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          funcionario_id: string
          id?: string
          observacao?: string | null
          template_id: string
          tipo_dia: string
          tipo_turno: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          funcionario_id?: string
          id?: string
          observacao?: string | null
          template_id?: string
          tipo_dia?: string
          tipo_turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_vinculacao_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "escala_template"
            referencedColumns: ["id"]
          },
        ]
      }
      extras_checkins: {
        Row: {
          checkin_ts: string
          checkout_ts: string | null
          cpf_hash: string | null
          external_id: string | null
          id: string
          nome_freelancer: string
          plataforma: string
          raw_payload: Json | null
          sector_id: string | null
          synced_at: string
          unit_id: string
        }
        Insert: {
          checkin_ts: string
          checkout_ts?: string | null
          cpf_hash?: string | null
          external_id?: string | null
          id?: string
          nome_freelancer: string
          plataforma: string
          raw_payload?: Json | null
          sector_id?: string | null
          synced_at?: string
          unit_id: string
        }
        Update: {
          checkin_ts?: string
          checkout_ts?: string | null
          cpf_hash?: string | null
          external_id?: string | null
          id?: string
          nome_freelancer?: string
          plataforma?: string
          raw_payload?: Json | null
          sector_id?: string | null
          synced_at?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extras_checkins_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_checkins_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_checkins_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      freelancer_checkins: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checkin_at: string
          checkin_date: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkin_selfie_url: string
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          checkout_selfie_url: string | null
          created_at: string
          entry_id: string | null
          freelancer_id: string
          id: string
          loja_id: string
          rejection_reason: string | null
          schedule_id: string | null
          station_id: string | null
          status: string
          valor_approved_at: string | null
          valor_approved_by: string | null
          valor_aprovado: number | null
          valor_informado: number | null
          valor_status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checkin_at?: string
          checkin_date?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_selfie_url: string
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_selfie_url?: string | null
          created_at?: string
          entry_id?: string | null
          freelancer_id: string
          id?: string
          loja_id: string
          rejection_reason?: string | null
          schedule_id?: string | null
          station_id?: string | null
          status?: string
          valor_approved_at?: string | null
          valor_approved_by?: string | null
          valor_aprovado?: number | null
          valor_informado?: number | null
          valor_status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checkin_at?: string
          checkin_date?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_selfie_url?: string
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          checkout_selfie_url?: string | null
          created_at?: string
          entry_id?: string | null
          freelancer_id?: string
          id?: string
          loja_id?: string
          rejection_reason?: string | null
          schedule_id?: string | null
          station_id?: string | null
          status?: string
          valor_approved_at?: string | null
          valor_approved_by?: string | null
          valor_aprovado?: number | null
          valor_informado?: number | null
          valor_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_checkins_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "freelancer_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_checkins_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_checkins_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_checkins_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "freelancer_checkins_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_checkins_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "checkin_stations"
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
          origem: string
          schedule_id: string | null
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
          origem?: string
          schedule_id?: string | null
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
          origem?: string
          schedule_id?: string | null
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
          {
            foreignKeyName: "freelancer_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "freelancer_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_profiles: {
        Row: {
          chave_pix: string | null
          cpf: string
          created_at: string
          foto_url: string | null
          id: string
          inativo: boolean
          inativo_marcado_em: string | null
          inativo_marcado_por: string | null
          nome_completo: string
          telefone: string | null
          tipo_chave_pix: string | null
          update_requested_at: string | null
          update_requested_by: string | null
        }
        Insert: {
          chave_pix?: string | null
          cpf: string
          created_at?: string
          foto_url?: string | null
          id?: string
          inativo?: boolean
          inativo_marcado_em?: string | null
          inativo_marcado_por?: string | null
          nome_completo: string
          telefone?: string | null
          tipo_chave_pix?: string | null
          update_requested_at?: string | null
          update_requested_by?: string | null
        }
        Update: {
          chave_pix?: string | null
          cpf?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          inativo?: boolean
          inativo_marcado_em?: string | null
          inativo_marcado_por?: string | null
          nome_completo?: string
          telefone?: string | null
          tipo_chave_pix?: string | null
          update_requested_at?: string | null
          update_requested_by?: string | null
        }
        Relationships: []
      }
      freelancer_profiles_audit: {
        Row: {
          after_chave_pix: string | null
          after_tipo_chave_pix: string | null
          before_chave_pix: string | null
          before_tipo_chave_pix: string | null
          id: string
          inferred_at: string
          inferred_by: string
          notes: string | null
          profile_id: string
        }
        Insert: {
          after_chave_pix?: string | null
          after_tipo_chave_pix?: string | null
          before_chave_pix?: string | null
          before_tipo_chave_pix?: string | null
          id?: string
          inferred_at?: string
          inferred_by: string
          notes?: string | null
          profile_id: string
        }
        Update: {
          after_chave_pix?: string | null
          after_tipo_chave_pix?: string | null
          before_chave_pix?: string | null
          before_tipo_chave_pix?: string | null
          id?: string
          inferred_at?: string
          inferred_by?: string
          notes?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_profiles_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holding_freelancer_forecast: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          forecast_date: string
          freelancer_count: number
          id: string
          reason: string | null
          sector_key: string
          shift_type: string
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          forecast_date: string
          freelancer_count?: number
          id?: string
          reason?: string | null
          sector_key: string
          shift_type: string
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          forecast_date?: string
          freelancer_count?: number
          id?: string
          reason?: string | null
          sector_key?: string
          shift_type?: string
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holding_freelancer_forecast_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_freelancer_forecast_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      holding_freelancer_rates: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          daily_rate: number
          effective_from: string
          id: string
          notes: string | null
          sector_key: string
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          effective_from?: string
          id?: string
          notes?: string | null
          sector_key: string
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          effective_from?: string
          id?: string
          notes?: string | null
          sector_key?: string
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holding_freelancer_rates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_freelancer_rates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      holding_staffing_config: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          day_of_week: number
          extras_count: number
          id: string
          month_year: string
          notes: string | null
          regime: string
          required_count: number
          sector_key: string
          shift_type: string
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          day_of_week: number
          extras_count?: number
          id?: string
          month_year?: string
          notes?: string | null
          regime?: string
          required_count?: number
          sector_key: string
          shift_type: string
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          extras_count?: number
          id?: string
          month_year?: string
          notes?: string | null
          regime?: string
          required_count?: number
          sector_key?: string
          shift_type?: string
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holding_staffing_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_staffing_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          ai_confianca: number | null
          ai_model: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          erro: string | null
          file_mime: string | null
          file_name: string | null
          id: string
          linhas_importadas: number
          linhas_validas: number
          lojas_nao_mapeadas: Json
          mapeamento_colunas: Json | null
          origem: Database["public"]["Enums"]["import_origem"]
          preview_data: Json | null
          source_url: string | null
          status: Database["public"]["Enums"]["import_status"]
          tipo_destino: Database["public"]["Enums"]["import_destino"] | null
          total_linhas: number
        }
        Insert: {
          ai_confianca?: number | null
          ai_model?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          erro?: string | null
          file_mime?: string | null
          file_name?: string | null
          id?: string
          linhas_importadas?: number
          linhas_validas?: number
          lojas_nao_mapeadas?: Json
          mapeamento_colunas?: Json | null
          origem: Database["public"]["Enums"]["import_origem"]
          preview_data?: Json | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          tipo_destino?: Database["public"]["Enums"]["import_destino"] | null
          total_linhas?: number
        }
        Update: {
          ai_confianca?: number | null
          ai_model?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          erro?: string | null
          file_mime?: string | null
          file_name?: string | null
          id?: string
          linhas_importadas?: number
          linhas_validas?: number
          lojas_nao_mapeadas?: Json
          mapeamento_colunas?: Json | null
          origem?: Database["public"]["Enums"]["import_origem"]
          preview_data?: Json | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          tipo_destino?: Database["public"]["Enums"]["import_destino"] | null
          total_linhas?: number
        }
        Relationships: []
      }
      inativacoes_audit_log: {
        Row: {
          acao: string
          contexto: Json | null
          employee_id: string
          estado_anterior: Json
          estado_novo: Json
          executado_em: string
          executado_por: string | null
          id: number
          motivo: string
        }
        Insert: {
          acao: string
          contexto?: Json | null
          employee_id: string
          estado_anterior: Json
          estado_novo: Json
          executado_em?: string
          executado_por?: string | null
          id?: number
          motivo: string
        }
        Update: {
          acao?: string
          contexto?: Json | null
          employee_id?: string
          estado_anterior?: Json
          estado_novo?: Json
          executado_em?: string
          executado_por?: string | null
          id?: number
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "inativacoes_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_snapshots: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          dados: Json
          id: string
          linhas_importadas: number | null
          meta_key: string
          referencia_label: string
          referencia_mes: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          dados: Json
          id?: string
          linhas_importadas?: number | null
          meta_key: string
          referencia_label: string
          referencia_mes: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          dados?: Json
          id?: string
          linhas_importadas?: number | null
          meta_key?: string
          referencia_label?: string
          referencia_mes?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      inventario_items: {
        Row: {
          created_at: string
          id: string
          inventario_id: string
          observacao: string | null
          quantidade_anterior: number
          quantidade_contada: number
          setor_item_id: string
          variacao: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventario_id: string
          observacao?: string | null
          quantidade_anterior?: number
          quantidade_contada?: number
          setor_item_id: string
          variacao?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventario_id?: string
          observacao?: string | null
          quantidade_anterior?: number
          quantidade_contada?: number
          setor_item_id?: string
          variacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_items_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_items_setor_item_id_fkey"
            columns: ["setor_item_id"]
            isOneToOne: false
            referencedRelation: "setor_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios: {
        Row: {
          created_at: string
          data_inventario: string
          id: string
          loja_id: string
          responsavel: string | null
          semana_referencia: string | null
          setor_id: string
          status: string
          tipo: string
          turno: string | null
        }
        Insert: {
          created_at?: string
          data_inventario: string
          id?: string
          loja_id: string
          responsavel?: string | null
          semana_referencia?: string | null
          setor_id: string
          status?: string
          tipo: string
          turno?: string | null
        }
        Update: {
          created_at?: string
          data_inventario?: string
          id?: string
          loja_id?: string
          responsavel?: string | null
          semana_referencia?: string | null
          setor_id?: string
          status?: string
          tipo?: string
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventarios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventarios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "inventarios_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
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
          {
            foreignKeyName: "inventory_transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      items_catalog: {
        Row: {
          code: string | null
          created_at: string
          family: string | null
          fornecedor_sugerido: string | null
          foto_url: string | null
          grande_grupo: string | null
          grupo: string | null
          id: string
          is_active: boolean
          is_utensilio: boolean
          item_type: string | null
          name: string
          preco_custo: number
          subgrupo: string | null
          unit: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          family?: string | null
          fornecedor_sugerido?: string | null
          foto_url?: string | null
          grande_grupo?: string | null
          grupo?: string | null
          id?: string
          is_active?: boolean
          is_utensilio?: boolean
          item_type?: string | null
          name: string
          preco_custo?: number
          subgrupo?: string | null
          unit?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          family?: string | null
          fornecedor_sugerido?: string | null
          foto_url?: string | null
          grande_grupo?: string | null
          grupo?: string | null
          id?: string
          is_active?: boolean
          is_utensilio?: boolean
          item_type?: string | null
          name?: string
          preco_custo?: number
          subgrupo?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      job_titles: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          is_canonical: boolean
          name: string
          unit_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          is_canonical?: boolean
          name: string
          unit_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          is_canonical?: boolean
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
          {
            foreignKeyName: "job_titles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
            foreignKeyName: "leadership_calculation_log_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "leadership_performance_scores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "leadership_store_scores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "maintenance_budgets_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      maintenance_entries: {
        Row: {
          anexo_url: string | null
          boleto_url: string | null
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
          boleto_url?: string | null
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
          boleto_url?: string | null
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
          {
            foreignKeyName: "maintenance_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
      metas_snapshot: {
        Row: {
          cmv_carnes: number | null
          cmv_carnes_anterior: number | null
          cmv_salmao: number | null
          cmv_salmao_anterior: number | null
          conformidade: number | null
          conformidade_anterior: number | null
          created_at: string
          id: string
          kds: number | null
          kds_anterior: number | null
          loja_codigo: string
          loja_id: string | null
          mes_ref: string
          nps: number | null
          nps_anterior: number | null
          observacoes: string | null
          red_flag: boolean
          updated_at: string
        }
        Insert: {
          cmv_carnes?: number | null
          cmv_carnes_anterior?: number | null
          cmv_salmao?: number | null
          cmv_salmao_anterior?: number | null
          conformidade?: number | null
          conformidade_anterior?: number | null
          created_at?: string
          id?: string
          kds?: number | null
          kds_anterior?: number | null
          loja_codigo: string
          loja_id?: string | null
          mes_ref: string
          nps?: number | null
          nps_anterior?: number | null
          observacoes?: string | null
          red_flag?: boolean
          updated_at?: string
        }
        Update: {
          cmv_carnes?: number | null
          cmv_carnes_anterior?: number | null
          cmv_salmao?: number | null
          cmv_salmao_anterior?: number | null
          conformidade?: number | null
          conformidade_anterior?: number | null
          created_at?: string
          id?: string
          kds?: number | null
          kds_anterior?: number | null
          loja_codigo?: string
          loja_id?: string | null
          mes_ref?: string
          nps?: number | null
          nps_anterior?: number | null
          observacoes?: string | null
          red_flag?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_snapshot_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_snapshot_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      missao_anexos: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          mime_type: string | null
          missao_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          mime_type?: string | null
          missao_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          missao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missao_anexos_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      missao_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["missao_chat_role"]
          semana_referencia: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["missao_chat_role"]
          semana_referencia: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["missao_chat_role"]
          semana_referencia?: string
          user_id?: string
        }
        Relationships: []
      }
      missao_comentarios: {
        Row: {
          created_at: string
          id: string
          missao_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          missao_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          missao_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missao_comentarios_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      missao_membros: {
        Row: {
          created_at: string
          missao_id: string
          papel: Database["public"]["Enums"]["missao_papel"]
          user_id: string
        }
        Insert: {
          created_at?: string
          missao_id: string
          papel?: Database["public"]["Enums"]["missao_papel"]
          user_id: string
        }
        Update: {
          created_at?: string
          missao_id?: string
          papel?: Database["public"]["Enums"]["missao_papel"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missao_membros_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      missao_tarefas: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string
          dia_semana: string | null
          id: string
          missao_id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao: string
          dia_semana?: string | null
          id?: string
          missao_id: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string
          dia_semana?: string | null
          id?: string
          missao_id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missao_tarefas_missao_id_fkey"
            columns: ["missao_id"]
            isOneToOne: false
            referencedRelation: "missoes"
            referencedColumns: ["id"]
          },
        ]
      }
      missoes: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string | null
          google_calendar_synced_at: string | null
          google_calendar_user_id: string | null
          google_event_id: string | null
          id: string
          prazo: string | null
          prioridade: Database["public"]["Enums"]["missao_prioridade"]
          semana_referencia: string | null
          status: Database["public"]["Enums"]["missao_status"]
          titulo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          descricao?: string | null
          google_calendar_synced_at?: string | null
          google_calendar_user_id?: string | null
          google_event_id?: string | null
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["missao_prioridade"]
          semana_referencia?: string | null
          status?: Database["public"]["Enums"]["missao_status"]
          titulo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string | null
          google_calendar_synced_at?: string | null
          google_calendar_user_id?: string | null
          google_event_id?: string | null
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["missao_prioridade"]
          semana_referencia?: string | null
          status?: Database["public"]["Enums"]["missao_status"]
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          data_movimentacao: string
          id: string
          loja_id: string
          observacao: string | null
          quantidade: number
          responsavel: string | null
          setor_destino_id: string | null
          setor_item_id: string
          tipo_movimentacao: string
        }
        Insert: {
          created_at?: string
          data_movimentacao?: string
          id?: string
          loja_id: string
          observacao?: string | null
          quantidade: number
          responsavel?: string | null
          setor_destino_id?: string | null
          setor_item_id: string
          tipo_movimentacao: string
        }
        Update: {
          created_at?: string
          data_movimentacao?: string
          id?: string
          loja_id?: string
          observacao?: string | null
          quantidade?: number
          responsavel?: string | null
          setor_destino_id?: string | null
          setor_item_id?: string
          tipo_movimentacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_setor_item_id_fkey"
            columns: ["setor_item_id"]
            isOneToOne: false
            referencedRelation: "setor_items"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_webhook_endpoints: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          loja_id_default: string | null
          nome: string
          secret_token: string
          slug: string
          tipo_dado: string
          total_recebido: number
          ultima_execucao_at: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          loja_id_default?: string | null
          nome: string
          secret_token: string
          slug: string
          tipo_dado?: string
          total_recebido?: number
          ultima_execucao_at?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          loja_id_default?: string | null
          nome?: string
          secret_token?: string
          slug?: string
          tipo_dado?: string
          total_recebido?: number
          ultima_execucao_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_webhook_endpoints_loja_id_default_fkey"
            columns: ["loja_id_default"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_webhook_endpoints_loja_id_default_fkey"
            columns: ["loja_id_default"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      n8n_webhook_executions: {
        Row: {
          created_at: string
          endpoint_id: string
          erros: Json | null
          id: string
          linhas_duplicadas: number
          linhas_inseridas: number
          linhas_invalidas: number
          linhas_processadas: number
          payload_recebido: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          endpoint_id: string
          erros?: Json | null
          id?: string
          linhas_duplicadas?: number
          linhas_inseridas?: number
          linhas_invalidas?: number
          linhas_processadas?: number
          payload_recebido?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          endpoint_id?: string
          erros?: Json | null
          id?: string
          linhas_duplicadas?: number
          linhas_inseridas?: number
          linhas_invalidas?: number
          linhas_processadas?: number
          payload_recebido?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_webhook_executions_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "n8n_webhook_endpoints"
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
          {
            foreignKeyName: "operational_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      payout_indicator_sources: {
        Row: {
          brand_filter: string | null
          cargo: string | null
          created_at: string
          id: number
          indicador: string
          is_active: boolean
          notes: string | null
          parser_fn: string
          source_meta_key: string
        }
        Insert: {
          brand_filter?: string | null
          cargo?: string | null
          created_at?: string
          id?: number
          indicador: string
          is_active?: boolean
          notes?: string | null
          parser_fn: string
          source_meta_key: string
        }
        Update: {
          brand_filter?: string | null
          cargo?: string | null
          created_at?: string
          id?: number
          indicador?: string
          is_active?: boolean
          notes?: string | null
          parser_fn?: string
          source_meta_key?: string
        }
        Relationships: []
      }
      payout_orphan_records: {
        Row: {
          detected_at: string
          id: number
          raw_loja_identifier: string
          raw_payload: Json | null
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          source_meta_key: string
        }
        Insert: {
          detected_at?: string
          id?: number
          raw_loja_identifier: string
          raw_payload?: Json | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source_meta_key: string
        }
        Update: {
          detected_at?: string
          id?: number
          raw_loja_identifier?: string
          raw_payload?: Json | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source_meta_key?: string
        }
        Relationships: []
      }
      payout_results_monthly: {
        Row: {
          breakpoint_atingido: number | null
          breakpoint_descricao: string | null
          cargo: string
          computed_at: string
          computed_by: string
          id: number
          indicador: string
          loja_id: string
          mes_ref: string
          override_reason: string | null
          override_user_id: string | null
          payout_brl: number
          resultado_valor: number | null
          run_id: string | null
          source_meta_key: string | null
          source_origin: string
        }
        Insert: {
          breakpoint_atingido?: number | null
          breakpoint_descricao?: string | null
          cargo: string
          computed_at?: string
          computed_by?: string
          id?: number
          indicador: string
          loja_id: string
          mes_ref: string
          override_reason?: string | null
          override_user_id?: string | null
          payout_brl?: number
          resultado_valor?: number | null
          run_id?: string | null
          source_meta_key?: string | null
          source_origin: string
        }
        Update: {
          breakpoint_atingido?: number | null
          breakpoint_descricao?: string | null
          cargo?: string
          computed_at?: string
          computed_by?: string
          id?: number
          indicador?: string
          loja_id?: string
          mes_ref?: string
          override_reason?: string | null
          override_user_id?: string | null
          payout_brl?: number
          resultado_valor?: number | null
          run_id?: string | null
          source_meta_key?: string | null
          source_origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_results_monthly_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_results_monthly_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      payout_role_target: {
        Row: {
          cargo: string
          id: number
          remuneracao_total_brl: number
          source: string | null
          updated_at: string | null
        }
        Insert: {
          cargo: string
          id?: number
          remuneracao_total_brl: number
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string
          id?: number
          remuneracao_total_brl?: number
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payout_rules: {
        Row: {
          breakpoint: number
          cargo: string
          created_at: string
          descricao: string
          direcao: string
          id: number
          indicador: string
          is_active: boolean
          payout_brl: number
          source: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          breakpoint: number
          cargo: string
          created_at?: string
          descricao: string
          direcao: string
          id?: number
          indicador: string
          is_active?: boolean
          payout_brl: number
          source?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          breakpoint?: number
          cargo?: string
          created_at?: string
          descricao?: string
          direcao?: string
          id?: number
          indicador?: string
          is_active?: boolean
          payout_brl?: number
          source?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      pix_validation_log: {
        Row: {
          attempted_chave_pix: string | null
          attempted_tipo_chave_pix: string | null
          created_at: string
          id: string
          operation: string
          profile_id: string | null
          rejection_reason: string | null
          triggered_by_user_id: string | null
          would_reject: boolean
        }
        Insert: {
          attempted_chave_pix?: string | null
          attempted_tipo_chave_pix?: string | null
          created_at?: string
          id?: string
          operation: string
          profile_id?: string | null
          rejection_reason?: string | null
          triggered_by_user_id?: string | null
          would_reject?: boolean
        }
        Update: {
          attempted_chave_pix?: string | null
          attempted_tipo_chave_pix?: string | null
          created_at?: string
          id?: string
          operation?: string
          profile_id?: string | null
          rejection_reason?: string | null
          triggered_by_user_id?: string | null
          would_reject?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pix_validation_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_acao: {
        Row: {
          comentario_id: string | null
          created_by: string | null
          data_criacao: string | null
          id: string
          responsavel: string | null
          status: string | null
          texto_acao: string
        }
        Insert: {
          comentario_id?: string | null
          created_by?: string | null
          data_criacao?: string | null
          id?: string
          responsavel?: string | null
          status?: string | null
          texto_acao: string
        }
        Update: {
          comentario_id?: string | null
          created_by?: string | null
          data_criacao?: string | null
          id?: string
          responsavel?: string | null
          status?: string | null
          texto_acao?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_acao_comentario_id_fkey"
            columns: ["comentario_id"]
            isOneToOne: false
            referencedRelation: "reclamacoes_comentarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_ajustes_manuais: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          employee_id: string | null
          id: string
          justificativa: string
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_destino: string | null
          sector_origem: string | null
          tipo: Database["public"]["Enums"]["pop_ajuste_tipo_enum"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          employee_id?: string | null
          id?: string
          justificativa: string
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_destino?: string | null
          sector_origem?: string | null
          tipo: Database["public"]["Enums"]["pop_ajuste_tipo_enum"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          employee_id?: string | null
          id?: string
          justificativa?: string
          refeicao?: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_destino?: string | null
          sector_origem?: string | null
          tipo?: Database["public"]["Enums"]["pop_ajuste_tipo_enum"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_ajustes_manuais_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_ajustes_manuais_sector_destino_fkey"
            columns: ["sector_destino"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_ajustes_manuais_sector_origem_fkey"
            columns: ["sector_origem"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_ajustes_manuais_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_ajustes_manuais_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      pop_minimo_padrao: {
        Row: {
          created_at: string
          created_by: string | null
          dia_semana: Database["public"]["Enums"]["pop_dia_semana_enum"]
          id: string
          minimo_clt: number
          minimo_freelancer: number
          quantidade_minima: number | null
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id: string
          unit_id: string
          versao_documento: string
          vigente_ate: string | null
          vigente_desde: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dia_semana: Database["public"]["Enums"]["pop_dia_semana_enum"]
          id?: string
          minimo_clt?: number
          minimo_freelancer?: number
          quantidade_minima?: number | null
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id: string
          unit_id: string
          versao_documento: string
          vigente_ate?: string | null
          vigente_desde: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dia_semana?: Database["public"]["Enums"]["pop_dia_semana_enum"]
          id?: string
          minimo_clt?: number
          minimo_freelancer?: number
          quantidade_minima?: number | null
          refeicao?: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id?: string
          unit_id?: string
          versao_documento?: string
          vigente_ate?: string | null
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_minimo_padrao_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_minimo_padrao_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_minimo_padrao_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      pop_overrides: {
        Row: {
          aprovado_por: string
          comunicado_ao_conselho: boolean
          created_at: string
          created_by: string | null
          data: string
          id: string
          motivo: string
          quantidade_minima: number
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          aprovado_por: string
          comunicado_ao_conselho?: boolean
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          motivo: string
          quantidade_minima: number
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string
          comunicado_ao_conselho?: boolean
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          motivo?: string
          quantidade_minima?: number
          refeicao?: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_overrides_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_overrides_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_overrides_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      pop_reconciliacao_log: {
        Row: {
          duracao_ms: number | null
          erro: string | null
          executado_em: string
          funcionarios_distintos_resolvidos: number
          id: string
          qtd_orfas_antes: number
          qtd_orfas_depois: number
          qtd_reconciliadas: number
        }
        Insert: {
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          funcionarios_distintos_resolvidos?: number
          id?: string
          qtd_orfas_antes?: number
          qtd_orfas_depois?: number
          qtd_reconciliadas?: number
        }
        Update: {
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          funcionarios_distintos_resolvidos?: number
          id?: string
          qtd_orfas_antes?: number
          qtd_orfas_depois?: number
          qtd_reconciliadas?: number
        }
        Relationships: []
      }
      pop_relatorios_enviados: {
        Row: {
          data: string
          enviado_em: string
          erro: string | null
          evolution_message_id: string | null
          id: string
          mensagem: string
          payload_json: Json | null
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          status_envio: Database["public"]["Enums"]["pop_status_envio_enum"]
          tentativa: number
          unit_id: string
        }
        Insert: {
          data: string
          enviado_em?: string
          erro?: string | null
          evolution_message_id?: string | null
          id?: string
          mensagem: string
          payload_json?: Json | null
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          status_envio?: Database["public"]["Enums"]["pop_status_envio_enum"]
          tentativa?: number
          unit_id: string
        }
        Update: {
          data?: string
          enviado_em?: string
          erro?: string | null
          evolution_message_id?: string | null
          id?: string
          mensagem?: string
          payload_json?: Json | null
          refeicao?: Database["public"]["Enums"]["pop_refeicao_enum"]
          status_envio?: Database["public"]["Enums"]["pop_status_envio_enum"]
          tentativa?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pop_relatorios_enviados_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pop_relatorios_enviados_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      pop_unidades_agregadas: {
        Row: {
          observacao: string | null
          unit_id_agregada: string
          unit_id_principal: string
        }
        Insert: {
          observacao?: string | null
          unit_id_agregada: string
          unit_id_principal: string
        }
        Update: {
          observacao?: string | null
          unit_id_agregada?: string
          unit_id_principal?: string
        }
        Relationships: []
      }
      pracas_plano_chao: {
        Row: {
          created_at: string
          dia_semana: string
          id: string
          nome_praca: string
          qtd_necessaria: number
          setor: string
          turno: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          id?: string
          nome_praca: string
          qtd_necessaria?: number
          setor: string
          turno: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          id?: string
          nome_praca?: string
          qtd_necessaria?: number
          setor?: string
          turno?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pracas_plano_chao_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pracas_plano_chao_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
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
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "reclamacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      reclamacoes_comentarios: {
        Row: {
          action_plan_id: string | null
          autor: string | null
          canal: string | null
          comentario: string
          created_at: string
          data_comentario: string | null
          id: string
          loja_codigo: string | null
          loja_id: string | null
          nota: number | null
          source_hash: string
          source_id: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          action_plan_id?: string | null
          autor?: string | null
          canal?: string | null
          comentario: string
          created_at?: string
          data_comentario?: string | null
          id?: string
          loja_codigo?: string | null
          loja_id?: string | null
          nota?: number | null
          source_hash: string
          source_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          action_plan_id?: string | null
          autor?: string | null
          canal?: string | null
          comentario?: string
          created_at?: string
          data_comentario?: string | null
          id?: string
          loja_codigo?: string | null
          loja_id?: string | null
          nota?: number | null
          source_hash?: string
          source_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_comentarios_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sheets_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_comentarios_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["sheets_source_id"]
          },
        ]
      }
      reclamacoes_config: {
        Row: {
          classificador_ai: boolean
          enabled: boolean
          id: string
          singleton: boolean
          source_id: string | null
          updated_at: string
        }
        Insert: {
          classificador_ai?: boolean
          enabled?: boolean
          id?: string
          singleton?: boolean
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          classificador_ai?: boolean
          enabled?: boolean
          id?: string
          singleton?: boolean
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamacoes_config_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sheets_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamacoes_config_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["sheets_source_id"]
          },
        ]
      }
      salmon_efficiency_daily: {
        Row: {
          consumption_kg: number | null
          created_at: string
          final_stock_kg: number
          id: number
          initial_stock_kg: number
          loja_id: string
          ratio_kg_per_1k: number | null
          revenue_brl: number
          semaphore: string | null
          source: string
          source_row_hash: string | null
          transaction_date: string
          transfer_kg: number
          updated_at: string
        }
        Insert: {
          consumption_kg?: number | null
          created_at?: string
          final_stock_kg: number
          id?: number
          initial_stock_kg: number
          loja_id: string
          ratio_kg_per_1k?: number | null
          revenue_brl: number
          semaphore?: string | null
          source?: string
          source_row_hash?: string | null
          transaction_date: string
          transfer_kg: number
          updated_at?: string
        }
        Update: {
          consumption_kg?: number | null
          created_at?: string
          final_stock_kg?: number
          id?: number
          initial_stock_kg?: number
          loja_id?: string
          ratio_kg_per_1k?: number | null
          revenue_brl?: number
          semaphore?: string | null
          source?: string
          source_row_hash?: string | null
          transaction_date?: string
          transfer_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
      schedule_breaks: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          planned_minutes: number | null
          schedule_date: string
          schedule_id: string
          started_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          planned_minutes?: number | null
          schedule_date: string
          schedule_id: string
          started_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          planned_minutes?: number | null
          schedule_date?: string
          schedule_id?: string
          started_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_breaks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_draft_slots: {
        Row: {
          agreed_rate: number
          break_min: number
          created_at: string
          dia_semana: string
          draft_id: string
          employee_id: string | null
          end_time: string
          id: string
          job_title_id: string | null
          notes: string | null
          papel: string
          schedule_date: string
          sector_id: string | null
          shift_label: string | null
          shift_type: string
          start_time: string
          tipo: string
          updated_at: string
        }
        Insert: {
          agreed_rate?: number
          break_min?: number
          created_at?: string
          dia_semana: string
          draft_id: string
          employee_id?: string | null
          end_time: string
          id?: string
          job_title_id?: string | null
          notes?: string | null
          papel?: string
          schedule_date: string
          sector_id?: string | null
          shift_label?: string | null
          shift_type?: string
          start_time: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          agreed_rate?: number
          break_min?: number
          created_at?: string
          dia_semana?: string
          draft_id?: string
          employee_id?: string | null
          end_time?: string
          id?: string
          job_title_id?: string | null
          notes?: string | null
          papel?: string
          schedule_date?: string
          sector_id?: string | null
          shift_label?: string | null
          shift_type?: string
          start_time?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_draft_slots_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "schedule_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_draft_slots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_draft_slots_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_draft_slots_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mode: string
          modelo_folga: string
          payload: Json | null
          published_at: string | null
          published_by: string | null
          sector_id: string | null
          semana_inicio: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          modelo_folga?: string
          payload?: Json | null
          published_at?: string | null
          published_by?: string | null
          sector_id?: string | null
          semana_inicio: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          modelo_folga?: string
          payload?: Json | null
          published_at?: string | null
          published_by?: string | null
          sector_id?: string | null
          semana_inicio?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_drafts_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_drafts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_drafts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      schedules: {
        Row: {
          agreed_rate: number | null
          break_duration: number
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_responded_at: string | null
          confirmation_status: string | null
          created_at: string
          denial_reason: string | null
          employee_id: string | null
          end_time: string | null
          id: string
          praca_id: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_responded_at?: string | null
          confirmation_status?: string | null
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          praca_id?: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_responded_at?: string | null
          confirmation_status?: string | null
          created_at?: string
          denial_reason?: string | null
          employee_id?: string | null
          end_time?: string | null
          id?: string
          praca_id?: string | null
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
            foreignKeyName: "schedules_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "pracas_plano_chao"
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
      sector_partnerships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          partner_sector_id: string
          sector_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_sector_id: string
          sector_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_sector_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_partnerships_partner_sector_id_fkey"
            columns: ["partner_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_partnerships_sector_id_fkey"
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
          {
            foreignKeyName: "sectors_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      semanas_cmv: {
        Row: {
          created_at: string | null
          data_fim: string
          data_inicio: string
          encerrada_em: string | null
          encerrada_por: string | null
          id: string
          loja_id: string
          responsavel: string | null
          saldo_anterior_json: Json | null
          status: string
        }
        Insert: {
          created_at?: string | null
          data_fim: string
          data_inicio: string
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          loja_id: string
          responsavel?: string | null
          saldo_anterior_json?: Json | null
          status?: string
        }
        Update: {
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          loja_id?: string
          responsavel?: string | null
          saldo_anterior_json?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "semanas_cmv_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semanas_cmv_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      setor_items: {
        Row: {
          catalog_item_id: string
          created_at: string
          estoque_maximo: number | null
          estoque_minimo: number
          id: string
          is_active: boolean
          loja_id: string
          ponto_pedido: number | null
          setor_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          estoque_maximo?: number | null
          estoque_minimo?: number
          id?: string
          is_active?: boolean
          loja_id: string
          ponto_pedido?: number | null
          setor_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          estoque_maximo?: number | null
          estoque_minimo?: number
          id?: string
          is_active?: boolean
          loja_id?: string
          ponto_pedido?: number | null
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setor_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "items_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setor_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setor_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "setor_items_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          loja_id: string | null
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          loja_id?: string | null
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          loja_id?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      sheets_blocks_snapshot: {
        Row: {
          block_key: string
          block_type: string
          created_at: string
          id: string
          loja_codigo: string | null
          mes_ref: string
          meta_key: string
          ordem: number
          payload: Json
          source_id: string | null
          updated_at: string
        }
        Insert: {
          block_key: string
          block_type: string
          created_at?: string
          id?: string
          loja_codigo?: string | null
          mes_ref: string
          meta_key: string
          ordem?: number
          payload?: Json
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          block_key?: string
          block_type?: string
          created_at?: string
          id?: string
          loja_codigo?: string | null
          mes_ref?: string
          meta_key?: string
          ordem?: number
          payload?: Json
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_blocks_snapshot_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sheets_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_blocks_snapshot_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["sheets_source_id"]
          },
        ]
      }
      sheets_sources: {
        Row: {
          ativo: boolean
          created_at: string
          deactivated_at: string | null
          deactivated_reason: string | null
          gid: string | null
          id: string
          meta_key: string | null
          nome: string
          sync_diario: boolean
          tipo_dado: Database["public"]["Enums"]["import_destino"]
          ultima_execucao_cron: string | null
          ultima_sincronizacao: string | null
          ultimo_erro: string | null
          ultimo_status: string | null
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deactivated_at?: string | null
          deactivated_reason?: string | null
          gid?: string | null
          id?: string
          meta_key?: string | null
          nome: string
          sync_diario?: boolean
          tipo_dado?: Database["public"]["Enums"]["import_destino"]
          ultima_execucao_cron?: string | null
          ultima_sincronizacao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deactivated_at?: string | null
          deactivated_reason?: string | null
          gid?: string | null
          id?: string
          meta_key?: string | null
          nome?: string
          sync_diario?: boolean
          tipo_dado?: Database["public"]["Enums"]["import_destino"]
          ultima_execucao_cron?: string | null
          ultima_sincronizacao?: string | null
          ultimo_erro?: string | null
          ultimo_status?: string | null
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
            foreignKeyName: "sheets_staging_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "sheets_staging_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sheets_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_staging_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["sheets_source_id"]
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
          created_from_draft_id: string | null
          end_time: string
          id: string
          name: string
          start_time: string
          type: string
        }
        Insert: {
          created_at?: string
          created_from_draft_id?: string | null
          end_time: string
          id?: string
          name: string
          start_time: string
          type?: string
        }
        Update: {
          created_at?: string
          created_from_draft_id?: string | null
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_created_from_draft_id_fkey"
            columns: ["created_from_draft_id"]
            isOneToOne: false
            referencedRelation: "schedule_drafts"
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
          {
            foreignKeyName: "sincronizacoes_sheets_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      solicitacoes_cadastro_urgente: {
        Row: {
          banco_id_criado: number | null
          cargo: string
          cpf: string | null
          created_at: string
          data_inicio_prevista: string
          data_revisao: string | null
          id: string
          justificativa: string
          nome_funcionario: string
          observacao_revisao: string | null
          revisado_por: string | null
          secullum_id_criado: number | null
          solicitante_email: string | null
          solicitante_id: string
          solicitante_nome: string
          status: Database["public"]["Enums"]["status_solicitacao_cadastro"]
          unit_id: string
          updated_at: string
          urgencia: Database["public"]["Enums"]["urgencia_cadastro"]
        }
        Insert: {
          banco_id_criado?: number | null
          cargo: string
          cpf?: string | null
          created_at?: string
          data_inicio_prevista: string
          data_revisao?: string | null
          id?: string
          justificativa: string
          nome_funcionario: string
          observacao_revisao?: string | null
          revisado_por?: string | null
          secullum_id_criado?: number | null
          solicitante_email?: string | null
          solicitante_id: string
          solicitante_nome: string
          status?: Database["public"]["Enums"]["status_solicitacao_cadastro"]
          unit_id: string
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_cadastro"]
        }
        Update: {
          banco_id_criado?: number | null
          cargo?: string
          cpf?: string | null
          created_at?: string
          data_inicio_prevista?: string
          data_revisao?: string | null
          id?: string
          justificativa?: string
          nome_funcionario?: string
          observacao_revisao?: string | null
          revisado_por?: string | null
          secullum_id_criado?: number | null
          solicitante_email?: string | null
          solicitante_id?: string
          solicitante_nome?: string
          status?: Database["public"]["Enums"]["status_solicitacao_cadastro"]
          unit_id?: string
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_cadastro"]
        }
        Relationships: []
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
          apoio_venda_budget: number
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
          apoio_venda_budget?: number
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
          apoio_venda_budget?: number
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
          {
            foreignKeyName: "store_budgets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "store_performance_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "store_performance_entries_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "supervision_audits_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
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
          {
            foreignKeyName: "supervision_failures_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      sync_secullum_log: {
        Row: {
          ate_ts: string | null
          desde_ts: string | null
          duracao_ms: number | null
          erro: string | null
          executado_em: string
          id: string
          max_fonte_dados_id: number | null
          origens_distribuicao: Json | null
          qtd_inserida: number
          qtd_orfas: number
          qtd_puxada: number
        }
        Insert: {
          ate_ts?: string | null
          desde_ts?: string | null
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          id?: string
          max_fonte_dados_id?: number | null
          origens_distribuicao?: Json | null
          qtd_inserida?: number
          qtd_orfas?: number
          qtd_puxada?: number
        }
        Update: {
          ate_ts?: string | null
          desde_ts?: string | null
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          id?: string
          max_fonte_dados_id?: number | null
          origens_distribuicao?: Json | null
          qtd_inserida?: number
          qtd_orfas?: number
          qtd_puxada?: number
        }
        Relationships: []
      }
      time_punches: {
        Row: {
          banco_id: number
          employee_id: string | null
          id: string
          punch_ts: string
          punch_type: Database["public"]["Enums"]["pop_punch_type_enum"] | null
          raw_payload: Json | null
          secullum_employee_id: number
          source: string
          synced_at: string
          unit_id: string | null
        }
        Insert: {
          banco_id?: number
          employee_id?: string | null
          id?: string
          punch_ts: string
          punch_type?: Database["public"]["Enums"]["pop_punch_type_enum"] | null
          raw_payload?: Json | null
          secullum_employee_id: number
          source?: string
          synced_at?: string
          unit_id?: string | null
        }
        Update: {
          banco_id?: number
          employee_id?: string | null
          id?: string
          punch_ts?: string
          punch_type?: Database["public"]["Enums"]["pop_punch_type_enum"] | null
          raw_payload?: Json | null
          secullum_employee_id?: number
          source?: string
          synced_at?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      turno_config: {
        Row: {
          ativo: boolean
          created_at: string
          cruza_meia_noite_1: boolean
          cruza_meia_noite_2: boolean
          dia_tipo: string | null
          entrada_1: string | null
          entrada_2: string | null
          gap_min: number
          id: string
          modelo_folga: string | null
          observacoes: string | null
          qtd_abridores: number
          qtd_fechadores: number
          qtd_intermediarios: number
          saida_1: string | null
          saida_2: string | null
          setor: string
          tipo_turno: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          cruza_meia_noite_1?: boolean
          cruza_meia_noite_2?: boolean
          dia_tipo?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          gap_min?: number
          id?: string
          modelo_folga?: string | null
          observacoes?: string | null
          qtd_abridores?: number
          qtd_fechadores?: number
          qtd_intermediarios?: number
          saida_1?: string | null
          saida_2?: string | null
          setor: string
          tipo_turno?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          cruza_meia_noite_1?: boolean
          cruza_meia_noite_2?: boolean
          dia_tipo?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          gap_min?: number
          id?: string
          modelo_folga?: string | null
          observacoes?: string | null
          qtd_abridores?: number
          qtd_fechadores?: number
          qtd_intermediarios?: number
          saida_1?: string | null
          saida_2?: string | null
          setor?: string
          tipo_turno?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turno_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      unit_partnerships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          partner_unit_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_unit_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          partner_unit_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_partnerships_partner_unit_id_fkey"
            columns: ["partner_unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_partnerships_partner_unit_id_fkey"
            columns: ["partner_unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "unit_partnerships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_partnerships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      unit_secullum_mapping: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          notas: string | null
          secullum_empresa_id: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          notas?: string | null
          secullum_empresa_id: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          notas?: string | null
          secullum_empresa_id?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_secullum_mapping_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_secullum_mapping_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          last_changed_at: string
          locked_until: string | null
          must_reset: boolean
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          last_changed_at?: string
          locked_until?: string | null
          must_reset?: boolean
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          last_changed_at?: string
          locked_until?: string | null
          must_reset?: boolean
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "user_stores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      utensilios_config: {
        Row: {
          budget_mensal: number | null
          created_at: string
          faturamento_mensal: number
          id: string
          loja_id: string
          mes_referencia: string
          percentual_budget: number
        }
        Insert: {
          budget_mensal?: number | null
          created_at?: string
          faturamento_mensal?: number
          id?: string
          loja_id: string
          mes_referencia: string
          percentual_budget?: number
        }
        Update: {
          budget_mensal?: number | null
          created_at?: string
          faturamento_mensal?: number
          id?: string
          loja_id?: string
          mes_referencia?: string
          percentual_budget?: number
        }
        Relationships: [
          {
            foreignKeyName: "utensilios_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      utensilios_contagens: {
        Row: {
          created_at: string
          data_contagem: string
          id: string
          loja_id: string
          observacao: string | null
          quantidade_contada: number
          responsavel: string | null
          semana_referencia: string
          turno: string
          utensilio_item_id: string
        }
        Insert: {
          created_at?: string
          data_contagem: string
          id?: string
          loja_id: string
          observacao?: string | null
          quantidade_contada?: number
          responsavel?: string | null
          semana_referencia: string
          turno: string
          utensilio_item_id: string
        }
        Update: {
          created_at?: string
          data_contagem?: string
          id?: string
          loja_id?: string
          observacao?: string | null
          quantidade_contada?: number
          responsavel?: string | null
          semana_referencia?: string
          turno?: string
          utensilio_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utensilios_contagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_contagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "utensilios_contagens_utensilio_item_id_fkey"
            columns: ["utensilio_item_id"]
            isOneToOne: false
            referencedRelation: "utensilios_items"
            referencedColumns: ["id"]
          },
        ]
      }
      utensilios_items: {
        Row: {
          area_responsavel: string
          catalog_item_id: string
          categoria: string | null
          created_at: string
          estoque_minimo: number
          id: string
          is_active: boolean
          loja_id: string
          ordem_prioridade: number
          valor_unitario: number
        }
        Insert: {
          area_responsavel?: string
          catalog_item_id: string
          categoria?: string | null
          created_at?: string
          estoque_minimo?: number
          id?: string
          is_active?: boolean
          loja_id: string
          ordem_prioridade?: number
          valor_unitario?: number
        }
        Update: {
          area_responsavel?: string
          catalog_item_id?: string
          categoria?: string | null
          created_at?: string
          estoque_minimo?: number
          id?: string
          is_active?: boolean
          loja_id?: string
          ordem_prioridade?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "utensilios_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "items_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_items_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      utensilios_pedidos: {
        Row: {
          ajuste_final: number | null
          config_id: string
          created_at: string
          custo_pedido: number | null
          id: string
          loja_id: string
          qtd_aprovada: number
          qtd_deficit: number
          status: string
          utensilio_item_id: string
          valor_unitario: number
        }
        Insert: {
          ajuste_final?: number | null
          config_id: string
          created_at?: string
          custo_pedido?: number | null
          id?: string
          loja_id: string
          qtd_aprovada?: number
          qtd_deficit?: number
          status?: string
          utensilio_item_id: string
          valor_unitario?: number
        }
        Update: {
          ajuste_final?: number | null
          config_id?: string
          created_at?: string
          custo_pedido?: number | null
          id?: string
          loja_id?: string
          qtd_aprovada?: number
          qtd_deficit?: number
          status?: string
          utensilio_item_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "utensilios_pedidos_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "utensilios_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utensilios_pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
          {
            foreignKeyName: "utensilios_pedidos_utensilio_item_id_fkey"
            columns: ["utensilio_item_id"]
            isOneToOne: false
            referencedRelation: "utensilios_items"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_dispatch_queue: {
        Row: {
          channel: string
          consumed_at: string | null
          created_at: string
          dispatch_responded_at: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          error_message: string | null
          id: string
          magic_link_expires_at: string | null
          magic_link_token: string | null
          message_template: string
          opened_at: string | null
          profile_id: string
          sent_at: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          consumed_at?: string | null
          created_at?: string
          dispatch_responded_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          error_message?: string | null
          id?: string
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          message_template: string
          opened_at?: string | null
          profile_id: string
          sent_at?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          consumed_at?: string | null
          created_at?: string
          dispatch_responded_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          error_message?: string | null
          id?: string
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          message_template?: string
          opened_at?: string | null
          profile_id?: string
          sent_at?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_dispatch_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cargos_pendentes_revisao: {
        Row: {
          cargo_texto: string | null
          first_seen: string | null
          id: string | null
          last_seen: string | null
          notas: string | null
          qtd_funcionarios: number | null
          revisado: boolean | null
          unidade: string | null
        }
        Relationships: []
      }
      v_payout_consolidated: {
        Row: {
          brand: string | null
          cargo: string | null
          detalhamento: Json | null
          loja_code: string | null
          loja_id: string | null
          loja_nome: string | null
          mes_ref: string | null
          metas_atingidas: number | null
          metas_total: number | null
          metas_zeradas: number | null
          payout_total_brl: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_results_monthly_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_results_monthly_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      v_payout_jobs_to_compute: {
        Row: {
          brand: string | null
          cargo: string | null
          indicador: string | null
          loja_code: string | null
          loja_id: string | null
          loja_nome: string | null
          mes_ref: string | null
          parser_fn: string | null
          sheets_source_id: string | null
          source_meta_key: string | null
          source_status: string | null
        }
        Relationships: []
      }
      v_salmon_daily: {
        Row: {
          consumption_kg: number | null
          created_at: string | null
          final_stock_kg: number | null
          id: number | null
          initial_stock_kg: number | null
          loja_id: string | null
          ratio_kg_per_1k: number | null
          revenue_brl: number | null
          semaphore: string | null
          source: string | null
          transaction_date: string | null
          transfer_kg: number | null
          updated_at: string | null
        }
        Insert: {
          consumption_kg?: number | null
          created_at?: string | null
          final_stock_kg?: number | null
          id?: number | null
          initial_stock_kg?: number | null
          loja_id?: string | null
          ratio_kg_per_1k?: number | null
          revenue_brl?: never
          semaphore?: string | null
          source?: string | null
          transaction_date?: string | null
          transfer_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          consumption_kg?: number | null
          created_at?: string | null
          final_stock_kg?: number | null
          id?: number | null
          initial_stock_kg?: number | null
          loja_id?: string | null
          ratio_kg_per_1k?: number | null
          revenue_brl?: never
          semaphore?: string | null
          source?: string | null
          transaction_date?: string | null
          transfer_kg?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      v_salmon_monthly_summary: {
        Row: {
          consumption_total_kg: number | null
          dias_amarelo: number | null
          dias_registrados: number | null
          dias_verde: number | null
          dias_vermelho: number | null
          loja_id: string | null
          month_ref: string | null
          ratio_avg: number | null
          ratio_best: number | null
          ratio_worst: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "config_lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salmon_efficiency_daily_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "v_payout_jobs_to_compute"
            referencedColumns: ["loja_id"]
          },
        ]
      }
      v_sync_secullum_health: {
        Row: {
          batidas_24h: number | null
          batidas_com_raw_payload: number | null
          batidas_historico_total: number | null
          batidas_orfas_24h: number | null
          batidas_sem_punch_type_24h: number | null
          consultado_em: string | null
          cursor_temporal: string | null
          execucoes_24h: number | null
          falhas_24h: number | null
          funcionarios_distintos_24h: number | null
          minutos_desde_ultima_sync: number | null
          pct_resolucao_24h: number | null
          status_semaforo: string | null
          tamanho_raw_payload_total: string | null
          ultima_duracao_ms: number | null
          ultima_exec_qualquer: string | null
          ultima_sucesso: string | null
        }
        Relationships: []
      }
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
      classify_payout: {
        Args: { p_cargo: string; p_indicador: string; p_valor: number }
        Returns: {
          breakpoint_atingido: number
          breakpoint_descricao: string
          direcao: string
          payout_brl: number
        }[]
      }
      cleanup_units_schedule_data: {
        Args: { p_unit_ids: string[] }
        Returns: Json
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
      compute_payouts: {
        Args: { p_mes_ref: string }
        Returns: {
          errors: Json
          failed: number
          orphans: number
          processed: number
          run_id: string
          succeeded: number
        }[]
      }
      consume_pix_magic_link: {
        Args: {
          p_new_chave_pix: string
          p_new_tipo_chave_pix: string
          p_token: string
        }
        Returns: Json
      }
      find_employee_by_secullum_id: {
        Args: { p_secullum_id: number }
        Returns: {
          employee_id: string
          unit_id: string
        }[]
      }
      get_bulk_import_template_data: {
        Args: { p_unit_id: string }
        Returns: {
          cargo: string
          cpf_mascarado: string
          employee_id: string
          job_title_id: string
          nome: string
          sector_id_padrao: string
          setor_padrao: string
        }[]
      }
      get_latest_payload: { Args: { p_meta_key: string }; Returns: Json }
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
      get_sync_batidas_cursor: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      holding_sector_label: { Args: { p_key: string }; Returns: string }
      import_payout_rules_from_sheet: {
        Args: never
        Returns: {
          errors: Json
          inserted: number
          skipped: number
          updated: number
        }[]
      }
      import_schedule_slots: {
        Args: {
          p_arquivo_nome?: string
          p_payload: Json
          p_unit_id: string
          p_week_start_date: string
        }
        Returns: Json
      }
      inativar_employee: {
        Args: { p_contexto?: Json; p_employee_id: string; p_motivo: string }
        Returns: boolean
      }
      is_aprovador_cadastro_urgente: { Args: never; Returns: boolean }
      is_first_user: { Args: never; Returns: boolean }
      is_missao_creator: {
        Args: { _missao_id: string; _user_id: string }
        Returns: boolean
      }
      is_missao_member: {
        Args: { _missao_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_freelancer_by_cpf: {
        Args: { p_cpf: string }
        Returns: {
          chave_pix: string
          funcao: string
          gerencia: string
          nome_completo: string
        }[]
      }
      lookup_freelancer_unified: {
        Args: { p_cpf: string }
        Returns: {
          chave_pix: string
          foto_url: string
          found_in: string[]
          funcao: string
          gerencia: string
          nome_completo: string
          telefone: string
          tipo_chave_pix: string
        }[]
      }
      merge_duplicate_employees:
        | {
            Args: {
              p_canonico_id: string
              p_duplicata_ids: string[]
              p_motivo?: string
            }
            Returns: Json
          }
        | { Args: { p_unit_id: string }; Returns: Json }
      merge_employees_into_secullum: {
        Args: { p_pairs: Json; p_unit_id: string }
        Returns: Json
      }
      normalize_loja_code: { Args: { p_raw: string }; Returns: string }
      normalize_sales_item_name: { Args: { name: string }; Returns: string }
      normalize_unit_code: { Args: { p_code: string }; Returns: string }
      parse_cmv_carnes_diff: {
        Args: { p_loja_id: string; p_mes_ref: string }
        Returns: number
      }
      parse_cmv_salmao_avg: {
        Args: { p_loja_id: string; p_mes_ref: string }
        Returns: number
      }
      parse_conformidade: {
        Args: { p_loja_id: string; p_mes_ref: string }
        Returns: number
      }
      parse_kds_brand_avg: {
        Args: { p_loja_id: string; p_mes_ref: string; p_meta_key: string }
        Returns: number
      }
      parse_nps_revenue: {
        Args: { p_canal: string; p_loja_id: string; p_mes_ref: string }
        Returns: number
      }
      parse_payout_registry_to_results: {
        Args: never
        Returns: {
          errors: Json
          inserted: number
          orphans: number
          updated: number
        }[]
      }
      peek_pix_magic_link: { Args: { p_token: string }; Returns: Json }
      pop_cleanup_raw_payloads: {
        Args: { p_dias_retencao?: number }
        Returns: {
          data_corte: string
          duracao_ms: number
          linhas_limpas: number
          mb_liberados: number
        }[]
      }
      pop_extras_hoje: {
        Args: { p_data: string; p_unit_id: string }
        Returns: {
          employee_id: string
          employee_name: string
          job_title: string
          punch_in_hora: string
          punch_in_ts: string
          secullum_id: number
          unit_id: string
        }[]
      }
      pop_quadro_detalhado: {
        Args: { p_data: string; p_unit_id: string }
        Returns: {
          atraso_minutos: number
          effective_end_time: string
          effective_start_time: string
          employee_id: string
          employee_name: string
          punch_in_hora: string
          punch_in_ts: string
          refeicao: string
          schedule_id: string
          scheduled_end_ts: string
          scheduled_fim_hora: string
          scheduled_inicio_hora: string
          scheduled_start_ts: string
          sector_id: string
          sector_name: string
          shift_id: string
          shift_name: string
          status: string
          unit_id: string
        }[]
      }
      pop_reconciliar_orfas: { Args: never; Returns: Json }
      pop_status_diario: {
        Args: { p_data?: string }
        Returns: {
          brand: string
          checkin_free: number
          data_referencia: string
          dia_semana: Database["public"]["Enums"]["pop_dia_semana_enum"]
          escalados_clt: number
          ponto_clt: number
          pop_clt: number
          pop_free: number
          pop_total: number
          refeicao: Database["public"]["Enums"]["pop_refeicao_enum"]
          sector_id: string
          sector_name: string
          status: string
          status_detalhe: string
          total_real: number
          unit_id: string
          unit_nome: string
        }[]
      }
      processar_inativacoes_diarias: {
        Args: {
          p_dias_aguardando_max?: number
          p_dias_sem_vinculo_max?: number
          p_dry_run?: boolean
        }
        Returns: {
          acao: string
          employee_id: string
          nome: string
          regra: string
          unidade: string
        }[]
      }
      promote_approved_checkins: {
        Args: { p_approval_id: string }
        Returns: number
      }
      publish_schedule_draft: {
        Args: { p_draft_id: string; p_override_pin?: string }
        Returns: Json
      }
      reativar_employee: {
        Args: { p_contexto?: Json; p_employee_id: string; p_motivo: string }
        Returns: boolean
      }
      reset_cmv_module: { Args: { p_unit_ids?: string[] }; Returns: Json }
      reset_sync_secullum_cursor: {
        Args: { p_motivo?: string; p_novo_cursor: number }
        Returns: Json
      }
      reset_unit_sales_data: { Args: { target_unit_id: string }; Returns: Json }
      resolve_cargo_canonico: {
        Args: { p_cargo_texto: string; p_unit_id: string }
        Returns: {
          canonico_id: string
          categoria: string
        }[]
      }
      resolve_loja_id: { Args: { p_raw_identifier: string }; Returns: string }
      resolve_punch_type_secullum: {
        Args: { p_sequencia: number }
        Returns: Database["public"]["Enums"]["pop_punch_type_enum"]
      }
      set_user_pin: { Args: { p_pin: string }; Returns: Json }
      sync_batidas_secullum: { Args: { p_payload: Json }; Returns: Json }
      sync_batidas_secullum_v2: { Args: { p_payload: Json }; Returns: Json }
      sync_funcionarios_secullum: { Args: { p_payload: Json }; Returns: Json }
      user_can_see_missao: {
        Args: { _missao_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_access_to_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      validate_payouts: {
        Args: { p_mes_ref: string }
        Returns: {
          divergencias: number
          divergencias_detalhe: Json
          match_pct: number
          matches: number
          total_auto: number
          total_manual: number
        }[]
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
      validate_schedule_publish: {
        Args: { p_draft_id: string; p_override_pin?: string }
        Returns: Json
      }
      verify_user_pin: {
        Args: { p_pin: string; p_user_id: string }
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
        | "aprovador_cadastro_urgente"
        | "dp_auditor"
      bonus_tier: "ouro" | "prata" | "bronze" | "aceitavel"
      categoria_cargo: "gerencia" | "chefia"
      codigo_meta:
        | "nps_salao"
        | "nps_delivery"
        | "supervisao"
        | "conformidade_setor"
        | "tempo_prato"
      familia_operacional: "front" | "back"
      import_destino:
        | "store_performance"
        | "store_performance_entries"
        | "reclamacoes"
        | "misto"
      import_origem: "upload_manual" | "cron_sheets" | "api"
      import_status:
        | "extracting"
        | "preview_ready"
        | "confirmed"
        | "error"
        | "cancelled"
      inventory_transaction_type:
        | "purchase"
        | "sale_deduction"
        | "waste"
        | "audit_adjustment"
        | "transfer_in"
        | "transfer_out"
      kpi_type: "nps" | "supervisao" | "tempo_prato" | "tempo_comanda"
      missao_chat_role: "user" | "assistant"
      missao_papel: "responsavel" | "co_responsavel"
      missao_prioridade: "alta" | "media" | "baixa"
      missao_status: "a_fazer" | "em_andamento" | "aguardando" | "concluido"
      origem_dado: "sheets" | "pdf" | "kds" | "manual"
      pop_ajuste_tipo_enum: "REMANEJAMENTO" | "RESERVA" | "AJUSTE_PONTO"
      pop_dia_semana_enum: "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM"
      pop_punch_type_enum: "entrada" | "saida_intervalo" | "retorno" | "saida"
      pop_refeicao_enum: "ALMOCO" | "JANTAR"
      pop_status_cor_enum: "verde" | "amarelo" | "vermelho"
      pop_status_envio_enum: "sucesso" | "falha" | "retry_agendado"
      position_type:
        | "gerente_front"
        | "gerente_back"
        | "chefia_front"
        | "chefia_back"
      schedule_type:
        | "working"
        | "off"
        | "vacation"
        | "sick_leave"
        | "banco_horas"
      sector_type: "salao" | "back" | "apv" | "delivery"
      setor_back: "cozinha" | "bar" | "parrilla" | "sushi"
      status_solicitacao_cadastro:
        | "pendente"
        | "em_analise"
        | "concluido"
        | "rejeitado"
      urgencia_cadastro: "baixa" | "media" | "alta" | "critica"
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
        "aprovador_cadastro_urgente",
        "dp_auditor",
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
      import_destino: [
        "store_performance",
        "store_performance_entries",
        "reclamacoes",
        "misto",
      ],
      import_origem: ["upload_manual", "cron_sheets", "api"],
      import_status: [
        "extracting",
        "preview_ready",
        "confirmed",
        "error",
        "cancelled",
      ],
      inventory_transaction_type: [
        "purchase",
        "sale_deduction",
        "waste",
        "audit_adjustment",
        "transfer_in",
        "transfer_out",
      ],
      kpi_type: ["nps", "supervisao", "tempo_prato", "tempo_comanda"],
      missao_chat_role: ["user", "assistant"],
      missao_papel: ["responsavel", "co_responsavel"],
      missao_prioridade: ["alta", "media", "baixa"],
      missao_status: ["a_fazer", "em_andamento", "aguardando", "concluido"],
      origem_dado: ["sheets", "pdf", "kds", "manual"],
      pop_ajuste_tipo_enum: ["REMANEJAMENTO", "RESERVA", "AJUSTE_PONTO"],
      pop_dia_semana_enum: ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"],
      pop_punch_type_enum: ["entrada", "saida_intervalo", "retorno", "saida"],
      pop_refeicao_enum: ["ALMOCO", "JANTAR"],
      pop_status_cor_enum: ["verde", "amarelo", "vermelho"],
      pop_status_envio_enum: ["sucesso", "falha", "retry_agendado"],
      position_type: [
        "gerente_front",
        "gerente_back",
        "chefia_front",
        "chefia_back",
      ],
      schedule_type: [
        "working",
        "off",
        "vacation",
        "sick_leave",
        "banco_horas",
      ],
      sector_type: ["salao", "back", "apv", "delivery"],
      setor_back: ["cozinha", "bar", "parrilla", "sushi"],
      status_solicitacao_cadastro: [
        "pendente",
        "em_analise",
        "concluido",
        "rejeitado",
      ],
      urgencia_cadastro: ["baixa", "media", "alta", "critica"],
      worker_type: ["clt", "freelancer"],
    },
  },
} as const

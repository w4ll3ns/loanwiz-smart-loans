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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_usage_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          cliente_id: string
          created_at: string
          data_emprestimo: string
          id: string
          numero_parcelas: number
          observacoes: string | null
          percentual: number
          periodicidade: string
          permite_cobranca_domingo: boolean | null
          permite_cobranca_sabado: boolean | null
          status: string
          tipo_juros: string
          updated_at: string
          valor_emprestado: number
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_emprestimo: string
          id?: string
          numero_parcelas: number
          observacoes?: string | null
          percentual: number
          periodicidade: string
          permite_cobranca_domingo?: boolean | null
          permite_cobranca_sabado?: boolean | null
          status?: string
          tipo_juros?: string
          updated_at?: string
          valor_emprestado: number
          valor_total: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_emprestimo?: string
          id?: string
          numero_parcelas?: number
          observacoes?: string | null
          percentual?: number
          periodicidade?: string
          permite_cobranca_domingo?: boolean | null
          permite_cobranca_sabado?: boolean | null
          status?: string
          tipo_juros?: string
          updated_at?: string
          valor_emprestado?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas: {
        Row: {
          contrato_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          data_vencimento_original: string | null
          id: string
          justificativa_alteracao_data: string | null
          numero_parcela: number
          status: string
          updated_at: string
          valor: number
          valor_original: number | null
          valor_pago: number | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          data_vencimento_original?: string | null
          id?: string
          justificativa_alteracao_data?: string | null
          numero_parcela: number
          status?: string
          updated_at?: string
          valor: number
          valor_original?: number | null
          valor_pago?: number | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          data_vencimento_original?: string | null
          id?: string
          justificativa_alteracao_data?: string | null
          numero_parcela?: number
          status?: string
          updated_at?: string
          valor?: number
          valor_original?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_historico: {
        Row: {
          created_at: string
          data_pagamento: string
          data_vencimento_anterior: string | null
          data_vencimento_nova: string | null
          id: string
          observacao: string | null
          parcela_id: string
          tipo_evento: string
          tipo_pagamento: string | null
          valor_pago: number | null
        }
        Insert: {
          created_at?: string
          data_pagamento?: string
          data_vencimento_anterior?: string | null
          data_vencimento_nova?: string | null
          id?: string
          observacao?: string | null
          parcela_id: string
          tipo_evento?: string
          tipo_pagamento?: string | null
          valor_pago?: number | null
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          data_vencimento_anterior?: string | null
          data_vencimento_nova?: string | null
          id?: string
          observacao?: string | null
          parcela_id?: string
          tipo_evento?: string
          tipo_pagamento?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_historico_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamentos_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          data_expiracao_teste: string | null
          email: string | null
          id: string
          nome: string | null
          observacoes_admin: string | null
          status_plano: string | null
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_expiracao_teste?: string | null
          email?: string | null
          id: string
          nome?: string | null
          observacoes_admin?: string | null
          status_plano?: string | null
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_expiracao_teste?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          observacoes_admin?: string | null
          status_plano?: string | null
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_global_stats: { Args: never; Returns: Json }
      admin_get_user_clientes: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_user_contratos: {
        Args: { p_user_id: string }
        Returns: {
          cliente_nome: string
          data_emprestimo: string
          id: string
          numero_parcelas: number
          periodicidade: string
          status: string
          valor_emprestado: number
          valor_total: number
        }[]
      }
      admin_get_user_stats: { Args: { p_user_id: string }; Returns: Json }
      ajustar_data_parcela: {
        Args: {
          p_data: string
          p_permite_domingo: boolean
          p_permite_sabado: boolean
        }
        Returns: string
      }
      check_api_rate_limit: {
        Args: {
          p_function_name: string
          p_max_calls?: number
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_api_usage_log: { Args: never; Returns: undefined }
      criar_contrato_com_parcelas: {
        Args: {
          p_cliente_id: string
          p_data_emprestimo: string
          p_numero_parcelas: number
          p_percentual: number
          p_periodicidade: string
          p_permite_domingo?: boolean
          p_permite_sabado?: boolean
          p_tipo_juros?: string
          p_valor_emprestado: number
        }
        Returns: string
      }
      dashboard_stats: { Args: never; Returns: Json }
      estornar_pagamento_parcela: {
        Args: { p_parcela_id: string }
        Returns: undefined
      }
      gerar_parcelas:
        | {
            Args: {
              p_contrato_id: string
              p_data_inicio: string
              p_numero_parcelas: number
              p_periodicidade: string
              p_valor_parcela: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_contrato_id: string
              p_data_inicio: string
              p_numero_parcelas: number
              p_periodicidade: string
              p_permite_domingo?: boolean
              p_permite_sabado?: boolean
              p_valor_parcela: number
            }
            Returns: undefined
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: {
        Args: { p_action: string; p_details?: Json; p_target_user_id?: string }
        Returns: undefined
      }
      is_user_active: { Args: { p_user_id: string }; Returns: boolean }
      log_api_usage: {
        Args: { p_function_name: string; p_user_id: string }
        Returns: undefined
      }
      recalcular_contrato_parcelas: {
        Args: {
          p_contrato_id: string
          p_percentual?: number
          p_tipo_juros: string
        }
        Returns: undefined
      }
      recalcular_parcelas_futuras: {
        Args: {
          p_contrato_id: string
          p_intervalo: string
          p_permite_domingo: boolean
          p_permite_sabado: boolean
        }
        Returns: undefined
      }
      registrar_pagamento_parcela: {
        Args: {
          p_data_pagamento: string
          p_observacao?: string
          p_parcela_id: string
          p_tipo: string
          p_valor: number
        }
        Returns: Json
      }
      update_own_profile: {
        Args: { p_email?: string; p_nome?: string; p_telefone?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
